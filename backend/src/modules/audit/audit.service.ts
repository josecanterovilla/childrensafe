import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  familyId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

/**
 * Servicio de auditoría append-only. Registrar nunca debe romper la operación de negocio:
 * si falla el log, se registra el error pero no se lanza.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          familyId: entry.familyId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`No se pudo escribir auditoría para ${entry.action}`, err as Error);
    }
  }
}
