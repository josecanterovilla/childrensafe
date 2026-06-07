import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Registra un AuditLog cuando un handler marcado con @Audit('ACTION') termina con éxito.
 * El familyId se toma de la membresía resuelta o del parámetro de ruta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actorUserId = req.user?.userId ?? null;
    const familyId = req.member?.familyId ?? (req.params?.familyId as string) ?? null;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          actorUserId,
          familyId,
          action,
          resourceType: req.route?.path,
          ip,
          userAgent: typeof userAgent === 'string' ? userAgent : undefined,
        });
      }),
    );
  }
}
