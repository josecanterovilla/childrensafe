import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Purga automática de datos con retención limitada (privacidad por diseño / GDPR).
 * Por defecto borra ubicaciones más antiguas que LOCATION_RETENTION_HOURS.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeOldLocations(): Promise<void> {
    const hours = this.config.get<number>('retention.locationHours') as number;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    const res = await this.prisma.location.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    if (res.count > 0) {
      this.logger.log(`Purgadas ${res.count} ubicaciones anteriores a ${cutoff.toISOString()}`);
    }
  }

  /** Limpia sesiones expiradas/revocadas hace tiempo (higiene de la tabla). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeStaleSessions(): Promise<void> {
    const res = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (res.count > 0) {
      this.logger.log(`Purgadas ${res.count} sesiones expiradas`);
    }
  }
}
