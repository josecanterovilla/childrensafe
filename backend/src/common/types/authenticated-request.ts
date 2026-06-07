import { Request } from 'express';
import { MemberRole } from '@prisma/client';

/** Contenido del JWT de acceso. */
export interface JwtPayload {
  sub: string; // userId
  type: 'access';
  iat?: number;
  exp?: number;
}

/** Usuario autenticado adjuntado a la petición por la estrategia JWT. */
export interface AuthUser {
  userId: string;
}

/** Membresía resuelta por FamilyMembershipGuard para rutas con :familyId. */
export interface ResolvedMembership {
  familyId: string;
  memberId: string;
  role: MemberRole;
  permissions: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  member?: ResolvedMembership;
}
