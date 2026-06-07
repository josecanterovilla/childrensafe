import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Familias a las que pertenece el usuario, con su rol en cada una. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId },
      include: { family: true },
    });
    return memberships.map((m) => ({
      familyId: m.familyId,
      name: m.family.name,
      role: m.role,
    }));
  }

  async getFamily(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true, email: true } } },
        },
        childProfiles: true,
      },
    });
    if (!family) throw new NotFoundException('Familia no encontrada');
    return family;
  }

  /** Crea una familia adicional; el creador queda como PARENT. */
  async create(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { name } });
      await tx.familyMember.create({
        data: { familyId: family.id, userId, role: MemberRole.PARENT },
      });
      return family;
    });
  }

  async rename(familyId: string, name: string) {
    return this.prisma.family.update({ where: { id: familyId }, data: { name } });
  }

  async listMembers(familyId: string) {
    return this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        childProfile: true,
      },
    });
  }

  async listChildren(familyId: string) {
    return this.prisma.childProfile.findMany({ where: { familyId } });
  }

  async updateMember(
    familyId: string,
    memberId: string,
    data: { role?: MemberRole; permissions?: Record<string, unknown> },
  ) {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');

    // No se puede convertir a un menor en tutor ni viceversa por esta vía (cambia el modelo).
    if (data.role && (data.role === MemberRole.CHILD) !== (member.role === MemberRole.CHILD)) {
      throw new BadRequestException('No se puede cambiar entre rol de menor y tutor');
    }

    // Proteger al último PARENT de la familia.
    if (data.role && member.role === MemberRole.PARENT && data.role !== MemberRole.PARENT) {
      await this.assertNotLastParent(familyId, memberId);
    }

    return this.prisma.familyMember.update({
      where: { id: memberId },
      data: {
        role: data.role,
        permissions: (data.permissions as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async removeMember(familyId: string, memberId: string, actingUserId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');

    if (member.userId === actingUserId) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo; transfiere o elimina la familia');
    }
    if (member.role === MemberRole.PARENT) {
      await this.assertNotLastParent(familyId, memberId);
    }

    await this.prisma.familyMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  private async assertNotLastParent(familyId: string, excludingMemberId: string) {
    const parents = await this.prisma.familyMember.count({
      where: { familyId, role: MemberRole.PARENT, id: { not: excludingMemberId } },
    });
    if (parents === 0) {
      throw new BadRequestException('La familia debe tener al menos un PARENT');
    }
  }
}
