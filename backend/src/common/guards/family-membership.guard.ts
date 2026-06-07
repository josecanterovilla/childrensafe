import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Resuelve la membresía del usuario en la familia indicada por :familyId (param o body),
 * la adjunta a la petición y, si el endpoint declara @Roles, exige que el rol coincida.
 *
 * Defensa en profundidad: además de este guard, los servicios filtran sus consultas por familyId.
 */
@Injectable()
export class FamilyMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException('No autenticado');
    }

    const familyId =
      (req.params?.familyId as string) ??
      (req.body?.familyId as string) ??
      (req.query?.familyId as string);

    if (!familyId) {
      throw new BadRequestException('Falta familyId');
    }

    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });

    if (!member) {
      throw new ForbiddenException('No perteneces a esta familia');
    }

    req.member = {
      familyId,
      memberId: member.id,
      role: member.role,
      permissions: (member.permissions as Record<string, unknown>) ?? {},
    };

    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    return true;
  }
}
