import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { FamilyMembershipGuard } from '../../common/guards/family-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { FamiliesService } from './families.service';
import { CreateFamilyDto, RenameFamilyDto, UpdateMemberDto } from './dto/families.dto';

@ApiTags('families')
@ApiBearerAuth()
@Controller('families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las familias del usuario actual' })
  list(@CurrentUser('userId') userId: string) {
    return this.families.listForUser(userId);
  }

  @Post()
  @Audit('FAMILY_CREATED')
  @ApiOperation({ summary: 'Crea una familia adicional' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateFamilyDto) {
    return this.families.create(userId, dto.name);
  }

  @Get(':familyId')
  @UseGuards(FamilyMembershipGuard)
  @ApiOperation({ summary: 'Detalle de la familia (miembros y menores)' })
  get(@Param('familyId') familyId: string) {
    return this.families.getFamily(familyId);
  }

  @Patch(':familyId')
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @Audit('FAMILY_RENAMED')
  @ApiOperation({ summary: 'Renombra la familia (solo PARENT)' })
  rename(@Param('familyId') familyId: string, @Body() dto: RenameFamilyDto) {
    return this.families.rename(familyId, dto.name);
  }

  @Get(':familyId/members')
  @UseGuards(FamilyMembershipGuard)
  @ApiOperation({ summary: 'Lista los miembros de la familia' })
  members(@Param('familyId') familyId: string) {
    return this.families.listMembers(familyId);
  }

  @Get(':familyId/children')
  @UseGuards(FamilyMembershipGuard)
  @ApiOperation({ summary: 'Lista los perfiles de menores de la familia' })
  children(@Param('familyId') familyId: string) {
    return this.families.listChildren(familyId);
  }

  @Patch(':familyId/members/:memberId')
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @Audit('MEMBER_UPDATED')
  @ApiOperation({ summary: 'Actualiza rol/permisos de un miembro (solo PARENT)' })
  updateMember(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.families.updateMember(familyId, memberId, dto);
  }

  @Delete(':familyId/members/:memberId')
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @Audit('MEMBER_REMOVED')
  @ApiOperation({ summary: 'Elimina un miembro de la familia (solo PARENT)' })
  removeMember(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.families.removeMember(familyId, memberId, userId);
  }
}
