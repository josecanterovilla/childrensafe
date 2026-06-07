import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../../../common/types/authenticated-request';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token inválido');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Cuenta no disponible');
    }
    return { userId: user.id };
  }
}
