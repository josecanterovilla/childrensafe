import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOpaqueToken, sha256 } from '../../common/utils/crypto.util';
import { JwtPayload } from '../../common/types/authenticated-request';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos de vida del access token
}

interface SessionContext {
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Emisión y rotación de tokens.
 * - Access: JWT firmado de vida corta.
 * - Refresh: token opaco aleatorio; en BD se guarda solo su hash (revocable y rotatorio).
 *   La rotación detecta reuso: si llega un refresh ya rotado, se revoca toda la cadena.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issuePair(userId: string, ctx: SessionContext = {}): Promise<TokenPair> {
    const accessTtl = this.config.get<number>('jwt.accessTtl') as number;
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') as number;

    const payload: JwtPayload = { sub: userId, type: 'access' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });

    const refreshToken = generateOpaqueToken();
    await this.prisma.session.create({
      data: {
        userId,
        deviceId: ctx.deviceId,
        tokenHash: sha256(refreshToken),
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async rotate(refreshToken: string, ctx: SessionContext = {}): Promise<TokenPair> {
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hash } });

    if (!session) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Detección de reuso: si ya fue rotado/revocado, anula toda la cadena del usuario.
    if (session.revokedAt || session.replacedById) {
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Reuso de token detectado; sesiones revocadas');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const pair = await this.issuePair(session.userId, {
      deviceId: session.deviceId ?? ctx.deviceId,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    const newSession = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(pair.refreshToken) },
    });

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: newSession?.id },
    });

    return pair;
  }

  async revoke(refreshToken: string): Promise<void> {
    const hash = sha256(refreshToken);
    await this.prisma.session.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
