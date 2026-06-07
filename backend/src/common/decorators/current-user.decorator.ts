import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, AuthUser } from '../types/authenticated-request';

/** Inyecta el usuario autenticado (o una de sus propiedades) en el handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return data ? request.user?.[data] : request.user;
  },
);

/** Inyecta la membresía resuelta (familyId, role) en rutas con :familyId. */
export const CurrentMembership = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.member;
});
