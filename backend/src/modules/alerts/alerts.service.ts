import { Injectable } from '@nestjs/common';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface CreateAlertParams {
  familyId: string;
  childProfileId?: string | null;
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  /** Si true, notifica a los tutores por push. */
  notify?: boolean;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(params: CreateAlertParams) {
    const alert = await this.prisma.alert.create({
      data: {
        familyId: params.familyId,
        childProfileId: params.childProfileId ?? null,
        type: params.type,
        severity: params.severity ?? AlertSeverity.INFO,
        title: params.title,
        message: params.message,
        data: params.data,
      },
    });

    // Difusión en tiempo real a los miembros conectados de la familia.
    this.realtime.emitAlert(params.familyId, {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      childProfileId: alert.childProfileId,
      createdAt: alert.createdAt,
    });

    if (params.notify !== false) {
      await this.notifications.notifyGuardians(params.familyId, {
        title: params.title,
        body: params.message,
        data: { alertId: alert.id, type: params.type },
        critical: params.severity === AlertSeverity.CRITICAL,
      });
    }

    return alert;
  }

  async list(familyId: string, status?: AlertStatus) {
    return this.prisma.alert.findMany({
      where: { familyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async acknowledge(familyId: string, alertId: string, userId: string) {
    // updateMany asegura que solo se afecte si la alerta pertenece a la familia (aislamiento).
    const res = await this.prisma.alert.updateMany({
      where: { id: alertId, familyId, status: AlertStatus.OPEN },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedByUserId: userId,
      },
    });
    return { updated: res.count };
  }
}
