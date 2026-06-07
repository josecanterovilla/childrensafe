import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/authenticated-request';

/**
 * Gateway de tiempo real (Socket.IO).
 *
 * - Autentica cada conexión con el access JWT (handshake `auth.token`).
 * - Une al cliente a una sala por cada familia a la que pertenece (`family:<id>`).
 * - Expone `emitLocation`/`emitAlert` para que los servicios difundan eventos en vivo.
 *
 * Aislamiento: un cliente solo recibe eventos de las familias de las que es miembro.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      if (payload.type !== 'access') throw new Error('wrong token type');

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new Error('inactive user');

      const memberships = await this.prisma.familyMember.findMany({
        where: { userId: user.id },
        select: { familyId: true },
      });

      client.data.userId = user.id;
      for (const m of memberships) {
        await client.join(`family:${m.familyId}`);
      }
      client.emit('ready', { families: memberships.map((m) => m.familyId) });
    } catch (err) {
      this.logger.debug(`Conexión WS rechazada: ${(err as Error).message}`);
      client.emit('unauthorized', { message: 'No autenticado' });
      client.disconnect(true);
    }
  }

  /** Difunde una actualización de ubicación a los miembros de la familia. */
  emitLocation(familyId: string, payload: Record<string, unknown>): void {
    this.server?.to(`family:${familyId}`).emit('location', payload);
  }

  /** Difunde una alerta (incluido SOS) a los miembros de la familia. */
  emitAlert(familyId: string, payload: Record<string, unknown>): void {
    this.server?.to(`family:${familyId}`).emit('alert', payload);
  }
}
