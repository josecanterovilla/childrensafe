import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Marca de alta prioridad (SOS). En iOS, las "critical alerts" requieren entitlement. */
  critical?: boolean;
}

/**
 * Abstracción de notificaciones push. En Fase 1 entrega a través de proveedores por plataforma:
 *   - Android: FCM
 *   - iOS: APNs
 * Aquí queda la interfaz y el enrutado por dispositivo. La integración real con FCM/APNs se
 * conecta en `dispatch()` (requiere credenciales en variables de entorno).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Envía una notificación a todos los tutores (PARENT/GUARDIAN) de una familia. */
  async notifyGuardians(familyId: string, payload: PushPayload): Promise<void> {
    const guardians = await this.prisma.familyMember.findMany({
      where: { familyId, role: { in: ['PARENT', 'GUARDIAN'] } },
      select: { userId: true },
    });
    await this.notifyUsers(
      guardians.map((g) => g.userId),
      payload,
    );
  }

  async notifyUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (userIds.length === 0) return;
    const devices = await this.prisma.device.findMany({
      where: { userId: { in: userIds }, status: 'ACTIVE', pushToken: { not: null } },
      select: { id: true, platform: true, pushToken: true },
    });
    await Promise.all(
      devices.map((d) => this.dispatch(d.platform, d.pushToken as string, payload)),
    );
  }

  /**
   * Punto de integración con el proveedor real. Por ahora registra la intención de envío.
   * TODO(Fase 1): conectar FCM (firebase-admin) y APNs (node-apn / http2) con credenciales.
   */
  private async dispatch(
    platform: Platform,
    pushToken: string,
    payload: PushPayload,
  ): Promise<void> {
    this.logger.log(
      `[push:${platform}] -> ${pushToken.slice(0, 8)}… "${payload.title}"` +
        (payload.critical ? ' (CRÍTICA)' : ''),
    );
  }
}
