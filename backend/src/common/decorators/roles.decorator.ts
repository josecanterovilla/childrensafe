import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a ciertos roles dentro de la familia.
 * Requiere que la ruta tenga :familyId y que FamilyMembershipGuard esté activo.
 */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
