import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberRole, PairingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  generatePairingCode,
  normalizePairingCode,
  sha256,
} from '../../common/utils/crypto.util';
import { CreatePairingCodeDto, JoinFamilyDto } from './dto/pairing.dto';

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokensService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * El tutor genera un código único, temporal y de un solo uso. Se devuelve en claro UNA sola
   * vez (en BD se guarda solo su hash). El QR codifica un deep link con el mismo código.
   */
  async createCode(familyId: string, createdByUserId: string, dto: CreatePairingCodeDto) {
    const ttl = this.config.get<number>('pairing.codeTtl') as number;

    // Reintenta si por casualidad el hash colisiona (extremadamente improbable).
    let code = generatePairingCode();
    let codeHash = sha256(normalizePairingCode(code));
    for (let i = 0; i < 3; i++) {
      const clash = await this.prisma.pairingCode.findUnique({ where: { codeHash } });
      if (!clash) break;
      code = generatePairingCode();
      codeHash = sha256(normalizePairingCode(code));
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);
    const record = await this.prisma.pairingCode.create({
      data: {
        familyId,
        createdByUserId,
        codeHash,
        targetRole: MemberRole.CHILD,
        childDisplayName: dto.childDisplayName,
        childAgeBand: dto.childAgeBand,
        expiresAt,
      },
    });

    return {
      pairingCodeId: record.id,
      code, // se muestra una sola vez
      qrPayload: `childrensafe://pair?code=${encodeURIComponent(code)}`,
      expiresAt,
    };
  }

  /** Lista los códigos de la familia SIN revelar el código (solo estado y vigencia). */
  async listCodes(familyId: string) {
    const codes = await this.prisma.pairingCode.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return codes.map((c) => ({
      id: c.id,
      status: c.status,
      childDisplayName: c.childDisplayName,
      childAgeBand: c.childAgeBand,
      expiresAt: c.expiresAt,
      consumedAt: c.consumedAt,
      createdAt: c.createdAt,
    }));
  }

  async revokeCode(familyId: string, codeId: string) {
    const res = await this.prisma.pairingCode.updateMany({
      where: { id: codeId, familyId, status: PairingStatus.PENDING },
      data: { status: PairingStatus.REVOKED },
    });
    if (res.count === 0) {
      throw new NotFoundException('Código no encontrado o ya no está activo');
    }
    return { success: true };
  }

  /**
   * El dispositivo del menor canjea el código. Operación atómica y de un solo uso:
   * valida vigencia, marca CONSUMED, crea el perfil del menor, registra el dispositivo y emite
   * tokens. Notifica al tutor (confirmación en ambos dispositivos).
   */
  async join(dto: JoinFamilyDto, ctx: RequestContext) {
    const normalized = normalizePairingCode(dto.code);
    const codeHash = sha256(normalized);

    const result = await this.prisma.$transaction(async (tx) => {
      const code = await tx.pairingCode.findUnique({ where: { codeHash } });
      if (!code) {
        throw new BadRequestException('Código inválido');
      }
      if (code.status !== PairingStatus.PENDING) {
        throw new BadRequestException('El código ya fue usado o anulado');
      }
      if (code.expiresAt < new Date()) {
        await tx.pairingCode.update({
          where: { id: code.id },
          data: { status: PairingStatus.EXPIRED },
        });
        throw new BadRequestException('El código ha expirado');
      }

      // Consumo de un solo uso, protegido por la condición de estado (evita doble canje).
      const consumed = await tx.pairingCode.updateMany({
        where: { id: code.id, status: PairingStatus.PENDING },
        data: { status: PairingStatus.CONSUMED, consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('El código ya fue usado');
      }

      // Crea la identidad del menor (sin credenciales), su membresía y su perfil.
      const childUser = await tx.user.create({
        data: { displayName: dto.displayName || code.childDisplayName || 'Menor' },
      });

      const member = await tx.familyMember.create({
        data: { familyId: code.familyId, userId: childUser.id, role: MemberRole.CHILD },
      });

      const childProfile = await tx.childProfile.create({
        data: {
          familyId: code.familyId,
          familyMemberId: member.id,
          displayName: dto.displayName || code.childDisplayName || 'Menor',
          ageBand: code.childAgeBand ?? 'CHILD',
        },
      });

      const device = await tx.device.create({
        data: {
          userId: childUser.id,
          familyId: code.familyId,
          platform: dto.device.platform,
          deviceName: dto.device.deviceName,
          deviceUuid: dto.device.deviceUuid,
          pushToken: dto.device.pushToken,
          appVersion: dto.device.appVersion,
          lastSeenAt: new Date(),
        },
      });

      await tx.pairingCode.update({
        where: { id: code.id },
        data: { consumedByUserId: childUser.id },
      });

      return { code, childUser, childProfile, device };
    });

    // Tokens para el dispositivo del menor.
    const pair = await this.tokens.issuePair(result.childUser.id, {
      deviceId: result.device.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Confirmación al tutor: aviso de que el dispositivo quedó enlazado.
    await this.notifications.notifyGuardians(result.code.familyId, {
      title: 'Dispositivo enlazado',
      body: `${result.childProfile.displayName} se ha vinculado a la familia.`,
      data: { childProfileId: result.childProfile.id },
    });

    await this.audit.record({
      actorUserId: result.childUser.id,
      familyId: result.code.familyId,
      action: 'PAIRING_CONSUMED',
      resourceType: 'PairingCode',
      resourceId: result.code.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return {
      familyId: result.code.familyId,
      childProfileId: result.childProfile.id,
      deviceId: result.device.id,
      ...pair,
    };
  }
}
