import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Exportación de datos (derecho de acceso/portabilidad, GDPR). Devuelve los datos del usuario
   * y, para las familias donde es tutor, su contenido. Acotado por tamaño (las ubicaciones se
   * limitan a las más recientes); una exportación completa pagina estos conjuntos.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { family: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const families: Array<Record<string, unknown>> = [];
    for (const m of user.memberships) {
      const base = { familyId: m.familyId, name: m.family.name, role: m.role };
      if (m.role === MemberRole.CHILD) {
        families.push(base);
        continue;
      }
      const [members, children, geofences, alerts, sosEvents] = await Promise.all([
        this.prisma.familyMember.findMany({
          where: { familyId: m.familyId },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        }),
        this.prisma.childProfile.findMany({ where: { familyId: m.familyId } }),
        this.prisma.geofence.findMany({ where: { familyId: m.familyId } }),
        this.prisma.alert.findMany({
          where: { familyId: m.familyId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.sosEvent.findMany({
          where: { childProfile: { familyId: m.familyId } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ]);

      const childIds = children.map((c) => c.id);
      const locations = await this.prisma.location.findMany({
        where: { childProfileId: { in: childIds } },
        orderBy: { recordedAt: 'desc' },
        take: 1000,
      });

      families.push({ ...base, members, children, geofences, alerts, sosEvents, locations });
    }

    await this.audit.record({
      actorUserId: userId,
      action: 'DATA_EXPORTED',
      resourceType: 'User',
      resourceId: userId,
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
      },
      families,
    };
  }

  /**
   * Eliminación de cuenta (derecho de supresión, GDPR). Reautentica con contraseña.
   * Si el usuario es el ÚNICO tutor (PARENT) de una familia, esa familia se elimina por completo
   * (cascada borra menores, dispositivos, ubicaciones, alertas, etc.). Acción auditada.
   */
  async deleteAccount(userId: string, password: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.passwordHash) {
      throw new ForbiddenException('Esta cuenta no puede auto-eliminarse por esta vía');
    }
    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    // Familias donde el usuario es el único PARENT → se eliminan completas.
    const parentFamilyIds = user.memberships
      .filter((m) => m.role === MemberRole.PARENT)
      .map((m) => m.familyId);

    const soleParentFamilyIds: string[] = [];
    for (const familyId of parentFamilyIds) {
      const otherParents = await this.prisma.familyMember.count({
        where: { familyId, role: MemberRole.PARENT, userId: { not: userId } },
      });
      if (otherParents === 0) soleParentFamilyIds.push(familyId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (soleParentFamilyIds.length > 0) {
        await tx.family.deleteMany({ where: { id: { in: soleParentFamilyIds } } });
      }
      await tx.user.delete({ where: { id: userId } });
    });

    // Auditoría con actor nulo (el usuario ya no existe) pero registrando el id eliminado.
    await this.audit.record({
      action: 'ACCOUNT_DELETED',
      resourceType: 'User',
      resourceId: userId,
      metadata: { deletedFamilies: soleParentFamilyIds },
    });

    return { success: true };
  }
}
