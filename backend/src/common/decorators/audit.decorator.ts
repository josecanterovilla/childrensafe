import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit_action';

/**
 * Marca una acción como auditable. El AuditInterceptor registrará un AuditLog inmutable
 * cuando el handler termine correctamente.
 * @param action Identificador estable, p. ej. "PAIRING_CONSUMED".
 */
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);
