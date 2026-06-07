import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { ArrivedDto, TriggerSosDto } from './dto/sos.dto';

@Injectable()
export class SosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  /** El menor activa el SOS: crea el evento y una alerta CRÍTICA notificada a los tutores. */
  async trigger(familyId: string, userId: string, dto: TriggerSosDto) {
    const child = await this.resolveOwnChildProfile(familyId, userId);
    const device = await this.prisma.device.findFirst({
      where: { familyId, userId, status: 'ACTIVE' },
      orderBy: { lastSeenAt: 'desc' },
    });

    const event = await this.prisma.sosEvent.create({
      data: {
        childProfileId: child.id,
        deviceId: device?.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        batteryLevel: dto.batteryLevel,
        message: dto.message,
      },
    });

    await this.alerts.create({
      familyId,
      childProfileId: child.id,
      type: 'SOS',
      severity: 'CRITICAL',
      title: `SOS de ${child.displayName}`,
      message: dto.message?.trim()
        ? `${child.displayName}: ${dto.message.trim()}`
        : `${child.displayName} ha activado el botón SOS.`,
      data: {
        sosEventId: event.id,
        ...(dto.latitude !== undefined ? { latitude: String(dto.latitude) } : {}),
        ...(dto.longitude !== undefined ? { longitude: String(dto.longitude) } : {}),
      },
    });

    return event;
  }

  /** "Llegué bien": tranquiliza a la familia con una alerta informativa. */
  async arrived(familyId: string, userId: string, dto: ArrivedDto) {
    const child = await this.resolveOwnChildProfile(familyId, userId);
    return this.alerts.create({
      familyId,
      childProfileId: child.id,
      type: 'ARRIVED_SAFELY',
      severity: 'INFO',
      title: 'Llegó bien',
      message: dto.place?.trim()
        ? `${child.displayName} avisa que llegó bien a ${dto.place.trim()}.`
        : `${child.displayName} avisa que llegó bien.`,
    });
  }

  async list(familyId: string, role: MemberRole, userId: string) {
    const where =
      role === MemberRole.CHILD
        ? { childProfile: { familyId, familyMember: { userId } } }
        : { childProfile: { familyId } };
    return this.prisma.sosEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolve(familyId: string, sosId: string, userId: string) {
    const event = await this.prisma.sosEvent.findFirst({
      where: { id: sosId, childProfile: { familyId } },
    });
    if (!event) throw new NotFoundException('Evento SOS no encontrado');
    return this.prisma.sosEvent.update({
      where: { id: sosId },
      data: { resolvedAt: new Date(), resolvedByUserId: userId },
    });
  }

  private async resolveOwnChildProfile(familyId: string, userId: string) {
    const child = await this.prisma.childProfile.findFirst({
      where: { familyId, familyMember: { userId } },
    });
    if (!child) {
      throw new ForbiddenException('Solo el dispositivo de un menor puede usar esta acción');
    }
    return child;
  }
}
