import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GeofencesService } from '../geofences/geofences.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ReportLocationDto } from './dto/location.dto';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly geofences: GeofencesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** El dispositivo del menor reporta su ubicación. Idempotente ante reenvíos. */
  async report(familyId: string, userId: string, dto: ReportLocationDto) {
    const child = await this.resolveOwnChildProfile(familyId, userId);

    const device = await this.prisma.device.findFirst({
      where: { familyId, userId, status: 'ACTIVE' },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Idempotencia: si ya existe (deviceId, clientEventId), no se duplica.
    if (dto.clientEventId && device) {
      const dup = await this.prisma.location.findUnique({
        where: {
          deviceId_clientEventId: { deviceId: device.id, clientEventId: dto.clientEventId },
        },
      });
      if (dup) return dup;
    }

    const location = await this.prisma.location.create({
      data: {
        childProfileId: child.id,
        deviceId: device?.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        batteryLevel: dto.batteryLevel,
        clientEventId: dto.clientEventId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      },
    });

    if (device) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          batteryLevel: dto.batteryLevel ?? device.batteryLevel,
        },
      });
    }

    // Difusión en tiempo real a los tutores conectados.
    this.realtime.emitLocation(familyId, {
      childProfileId: child.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      batteryLevel: location.batteryLevel,
      recordedAt: location.recordedAt,
    });

    // Evalúa geocercas (genera eventos/alertas ENTER/EXIT si hay cambio de estado).
    await this.geofences.evaluateForChild(
      familyId,
      child.id,
      child.displayName,
      dto.latitude,
      dto.longitude,
    );

    return location;
  }

  async latest(familyId: string, childProfileId: string, role: MemberRole, userId: string) {
    await this.assertCanReadChild(familyId, childProfileId, role, userId);
    const loc = await this.prisma.location.findFirst({
      where: { childProfileId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!loc) throw new NotFoundException('Sin ubicaciones registradas');
    return loc;
  }

  async history(
    familyId: string,
    childProfileId: string,
    role: MemberRole,
    userId: string,
    limit = 100,
  ) {
    await this.assertCanReadChild(familyId, childProfileId, role, userId);
    const retentionHours = this.config.get<number>('retention.locationHours') as number;
    const since = new Date(Date.now() - retentionHours * 3600 * 1000);
    return this.prisma.location.findMany({
      where: { childProfileId, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  private async resolveOwnChildProfile(familyId: string, userId: string) {
    const child = await this.prisma.childProfile.findFirst({
      where: { familyId, familyMember: { userId } },
    });
    if (!child) {
      throw new ForbiddenException('Solo el dispositivo de un menor puede reportar ubicación');
    }
    return child;
  }

  /** Tutores leen cualquier menor de la familia; un menor solo se lee a sí mismo. */
  private async assertCanReadChild(
    familyId: string,
    childProfileId: string,
    role: MemberRole,
    userId: string,
  ) {
    const child = await this.prisma.childProfile.findFirst({
      where: { id: childProfileId, familyId },
      include: { familyMember: true },
    });
    if (!child) throw new NotFoundException('Menor no encontrado');
    if (role === MemberRole.CHILD && child.familyMember.userId !== userId) {
      throw new ForbiddenException('No puedes ver la ubicación de otro menor');
    }
  }
}
