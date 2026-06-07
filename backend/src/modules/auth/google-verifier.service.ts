import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string; // identificador estable de la cuenta de Google
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Verifica el ID token de Google contra las claves públicas de Google y valida que la audiencia
 * sea nuestro Web Client ID. Inyectable para poder mockearlo en pruebas.
 */
@Injectable()
export class GoogleVerifier {
  private readonly logger = new Logger(GoogleVerifier.name);
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('google.clientId') ?? '';
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.clientId) {
      throw new UnauthorizedException('El inicio con Google no está configurado en el servidor');
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error('payload de Google incompleto');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified ?? false,
        name: payload.name,
      };
    } catch (err) {
      this.logger.debug(`Token de Google inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token de Google inválido');
    }
  }
}
