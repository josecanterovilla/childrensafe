import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertSeverity,
  GeofenceEventType,
  GeofenceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { isInside } from '../../common/utils/geo.util';
import { CreateGeofenceDto, UpdateGeofenceDto } from './dto/geofences.dto';

@Injectable()
export class GeofencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async create(familyId: string, createdByUserId: string, dto: CreateGeofenceDto) {
    return this.prisma.geofence.create({
      data: {
        familyId,
        createdByUserId,
        childProfileId: dto.childProfileId,
        name: dto.name,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusM: dto.radiusM,
        schedule: (dto.schedule as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async list(familyId: string) {
    return this.prisma.geofence.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(familyId: string, geofenceId: string, dto: UpdateGeofenceDto) {
    const fence = await this.prisma.geofence.findFirst({ where: { id: geofenceId, familyId } });
    if (!fence) throw new NotFoundException('Geocerca no encontrada');
    return this.prisma.geofence.update({
      where: { id: geofenceId },
      data: {
        name: dto.name,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusM: dto.radiusM,
        active: dto.active,
        schedule: (dto.schedule as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async remove(familyId: string, geofenceId: string) {
    const res = await this.prisma.geofence.deleteMany({ where: { id: geofenceId, familyId } });
    if (res.count === 0) throw new NotFoundException('Geocerca no encontrada');
    return { success: true };
  }

  /**
   * Evalúa la posición del menor contra las geocercas activas de la familia y genera eventos
   * ENTER/EXIT (con su alerta) solo cuando hay un cambio de estado respecto al último evento.
   */
  async evaluateForChild(
    familyId: string,
    childProfileId: string,
    childName: string,
    lat: number,
    lon: number,
  ): Promise<void> {
    const fences = await this.prisma.geofence.findMany({
      where: {
        familyId,
        active: true,
        OR: [{ childProfileId: null }, { childProfileId }],
      },
    });

    for (const fence of fences) {
      const inside = isInside(lat, lon, fence.latitude, fence.longitude, fence.radiusM);

      const last = await this.prisma.geofenceEvent.findFirst({
        where: { geofenceId: fence.id, childProfileId },
        orderBy: { occurredAt: 'desc' },
      });
      const wasInside = last?.type === GeofenceEventType.ENTER;

      if (inside === wasInside) continue; // sin cambio de estado
      if (inside === false && last === null) continue; // primer dato fuera: no es una "salida"

      const type = inside ? GeofenceEventType.ENTER : GeofenceEventType.EXIT;
      await this.prisma.geofenceEvent.create({
        data: { geofenceId: fence.id, childProfileId, type, occurredAt: new Date() },
      });

      await this.emitAlert(familyId, childProfileId, childName, fence.type, fence.name, type);
    }
  }

  private async emitAlert(
    familyId: string,
    childProfileId: string,
    childName: string,
    fenceType: GeofenceType,
    fenceName: string,
    eventType: GeofenceEventType,
  ): Promise<void> {
    const entering = eventType === GeofenceEventType.ENTER;

    // Entrar en una zona peligrosa es crítico.
    if (fenceType === GeofenceType.DANGER && entering) {
      await this.alerts.create({
        familyId,
        childProfileId,
        type: 'GEOFENCE_ENTER',
        severity: AlertSeverity.CRITICAL,
        title: 'Zona peligrosa',
        message: `${childName} ha entrado en la zona peligrosa "${fenceName}".`,
        data: { fenceName },
      });
      return;
    }

    await this.alerts.create({
      familyId,
      childProfileId,
      type: entering ? 'GEOFENCE_ENTER' : 'GEOFENCE_EXIT',
      severity: AlertSeverity.INFO,
      title: entering ? `Llegó a ${fenceName}` : `Salió de ${fenceName}`,
      message: entering
        ? `${childName} llegó a "${fenceName}".`
        : `${childName} salió de "${fenceName}".`,
      data: { fenceName },
    });
  }
}
