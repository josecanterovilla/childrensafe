import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { RegisterDeviceDto, DeviceHeartbeatDto } from './dto/devices.dto';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Registra (o reactiva) el dispositivo del usuario en la familia.
   * Anti-suplantación: si el deviceUuid existe pero pertenece a otro usuario, se rechaza.
   */
  async register(familyId: string, userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findUnique({
      where: { deviceUuid: dto.deviceUuid },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException('Ese dispositivo ya está registrado por otra cuenta');
    }

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          familyId,
          platform: dto.platform,
          deviceName: dto.deviceName,
          pushToken: dto.pushToken ?? existing.pushToken,
          appVersion: dto.appVersion ?? existing.appVersion,
          status: 'ACTIVE',
          revokedAt: null,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.device.create({
      data: {
        userId,
        familyId,
        platform: dto.platform,
        deviceName: dto.deviceName,
        deviceUuid: dto.deviceUuid,
        pushToken: dto.pushToken,
        appVersion: dto.appVersion,
        lastSeenAt: new Date(),
      },
    });
  }

  /** Actualiza estado del dispositivo (batería, token push, última conexión). */
  async heartbeat(familyId: string, userId: string, deviceId: string, dto: DeviceHeartbeatDto) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, familyId, userId },
    });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');

    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        batteryLevel: dto.batteryLevel ?? device.batteryLevel,
        pushToken: dto.pushToken ?? device.pushToken,
        appVersion: dto.appVersion ?? device.appVersion,
        lastSeenAt: new Date(),
      },
    });

    // Alerta de batería baja para el dispositivo de un menor.
    if (dto.batteryLevel !== undefined && dto.batteryLevel <= 10) {
      const childProfile = await this.prisma.childProfile.findFirst({
        where: { familyId, familyMember: { userId } },
      });
      if (childProfile) {
        await this.alerts.create({
          familyId,
          childProfileId: childProfile.id,
          type: 'LOW_BATTERY',
          severity: 'WARNING',
          title: 'Batería baja',
          message: `El dispositivo de ${childProfile.displayName} está al ${dto.batteryLevel}%.`,
          data: { batteryLevel: String(dto.batteryLevel) },
        });
      }
    }

    return updated;
  }

  /** Lista dispositivos: tutores ven todos; un menor solo ve los suyos. */
  async list(familyId: string, role: MemberRole, userId: string) {
    return this.prisma.device.findMany({
      where: { familyId, ...(role === MemberRole.CHILD ? { userId } : {}) },
      orderBy: { linkedAt: 'desc' },
    });
  }

  async revoke(familyId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, familyId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');

    return this.prisma.device.update({
      where: { id: device.id },
      data: { status: 'REVOKED', revokedAt: new Date(), pushToken: null },
    });
  }
}
