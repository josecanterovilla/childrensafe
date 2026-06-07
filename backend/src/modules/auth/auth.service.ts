import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokensService, TokenPair } from './tokens.service';
import { PasswordService } from './password.service';
import { GoogleVerifier } from './google-verifier.service';
import { generateOpaqueToken, sha256 } from '../../common/utils/crypto.util';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutos

// Tolera ±1 ventana de 30 s al verificar TOTP (desfase de reloj entre el dispositivo y el servidor).
authenticator.options = { window: 1 };

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly google: GoogleVerifier,
  ) {}

  /** Registro de un tutor + creación opcional de su familia (queda como PARENT). */
  async register(dto: RegisterDto, ctx: RequestContext): Promise<TokenPair & { userId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
        },
      });

      const family = await tx.family.create({
        data: { name: dto.familyName?.trim() || `Familia de ${dto.displayName}` },
      });

      await tx.familyMember.create({
        data: { familyId: family.id, userId: createdUser.id, role: 'PARENT' },
      });

      return createdUser;
    });

    await this.audit.record({
      actorUserId: user.id,
      action: 'ACCOUNT_REGISTERED',
      resourceType: 'User',
      resourceId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const pair = await this.tokens.issuePair(user.id, ctx);
    return { userId: user.id, ...pair };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<TokenPair & { userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Mensaje genérico para no revelar si el correo existe (anti-enumeración).
    const invalid = new UnauthorizedException('Credenciales inválidas');
    if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
      // Igual gastamos tiempo de verificación para mitigar timing attacks.
      await this.passwords.hash(dto.password).catch(() => undefined);
      throw invalid;
    }

    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw invalid;
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode || !user.mfaSecret) {
        throw new UnauthorizedException('Se requiere código MFA');
      }
      const valid = authenticator.verify({ token: dto.mfaCode, secret: user.mfaSecret });
      if (!valid) {
        throw new UnauthorizedException('Código MFA inválido');
      }
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const pair = await this.tokens.issuePair(user.id, ctx);
    return { userId: user.id, ...pair };
  }

  /**
   * Inicio de sesión con Google (para tutores). Verifica el ID token, y:
   *  - si ya existe la cuenta por googleId, inicia sesión;
   *  - si existe por email (verificado), enlaza la cuenta de Google;
   *  - si no existe, crea el tutor + su familia.
   */
  async loginWithGoogle(
    idToken: string,
    ctx: RequestContext,
  ): Promise<TokenPair & { userId: string; isNew: boolean }> {
    const profile = await this.google.verify(idToken);
    if (!profile.emailVerified) {
      throw new UnauthorizedException('Tu correo de Google no está verificado');
    }

    let isNew = false;
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        // Enlaza la cuenta existente (mismo email verificado) con Google.
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.sub },
        });
        await this.audit.record({
          actorUserId: user.id,
          action: 'GOOGLE_LINKED',
          resourceType: 'User',
          resourceId: user.id,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
      }
    }

    if (!user) {
      isNew = true;
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: profile.email,
            googleId: profile.sub,
            displayName: profile.name?.trim() || profile.email.split('@')[0],
          },
        });
        const family = await tx.family.create({
          data: { name: `Familia de ${created.displayName}` },
        });
        await tx.familyMember.create({
          data: { familyId: family.id, userId: created.id, role: 'PARENT' },
        });
        return created;
      });
      await this.audit.record({
        actorUserId: user.id,
        action: 'ACCOUNT_REGISTERED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { provider: 'google' },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Cuenta no disponible');
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'LOGIN_GOOGLE',
      resourceType: 'User',
      resourceId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const pair = await this.tokens.issuePair(user.id, ctx);
    return { userId: user.id, isNew, ...pair };
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, ctx);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.revoke(refreshToken);
    return { success: true };
  }

  // ─────────────────────── Recuperación de contraseña ───────────────────────

  /**
   * Inicia la recuperación. Responde SIEMPRE igual (anti-enumeración de cuentas).
   * Si la cuenta existe, crea un token de un solo uso y lo "envía" por correo.
   */
  async forgotPassword(email: string, ctx: RequestContext): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash && user.status === 'ACTIVE') {
      const token = generateOpaqueToken(32);
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      // TODO(producción): enviar el enlace por correo. En desarrollo se registra para pruebas.
      if (this.config.get<string>('env') !== 'production') {
        this.logger.log(`[reset] token para ${email}: ${token}`);
      }
      await this.audit.record({
        actorUserId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
    return { success: true };
  }

  /** Completa la recuperación: valida el token, cambia la contraseña y revoca sesiones. */
  async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    // Invalida cualquier reset pendiente y todas las sesiones (seguridad).
    await this.prisma.passwordReset.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.tokens.revokeAllForUser(record.userId);

    await this.audit.record({
      actorUserId: record.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: record.userId,
    });
    return { success: true };
  }

  /** Cambia la contraseña reautenticando con la actual; revoca todas las sesiones. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('No autorizado');
    }
    const ok = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!ok) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);

    await this.audit.record({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      resourceType: 'User',
      resourceId: userId,
    });
    return { success: true };
  }

  // ─────────────────────────────── MFA (TOTP) ───────────────────────────────

  /** Genera un secreto TOTP (aún sin activar) y devuelve el otpauth:// para el authenticator. */
  async mfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('No autorizado');

    const secret = authenticator.generateSecret();
    // Se guarda el secreto pero mfaEnabled sigue false hasta confirmar con un código válido.
    // TODO(producción): cifrar mfaSecret a nivel de campo (KMS).
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    const label = user.email ?? user.id;
    const otpauthUrl = authenticator.keyuri(label, 'ChildrenSafe', secret);
    return { secret, otpauthUrl };
  }

  /** Activa MFA tras verificar un código del secreto pendiente. */
  async mfaEnable(userId: string, code: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('Primero inicia la configuración de MFA');
    }
    if (!authenticator.verify({ token: code, secret: user.mfaSecret })) {
      throw new BadRequestException('Código MFA inválido');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.record({
      actorUserId: userId,
      action: 'MFA_ENABLED',
      resourceType: 'User',
      resourceId: userId,
    });
    return { success: true };
  }

  /** Desactiva MFA reautenticando con contraseña + código. */
  async mfaDisable(userId: string, password: string, code: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash || !user.mfaSecret) {
      throw new BadRequestException('MFA no está activo');
    }
    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok || !authenticator.verify({ token: code, secret: user.mfaSecret })) {
      throw new UnauthorizedException('Credenciales o código inválidos');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    await this.audit.record({
      actorUserId: userId,
      action: 'MFA_DISABLED',
      resourceType: 'User',
      resourceId: userId,
    });
    return { success: true };
  }
}
