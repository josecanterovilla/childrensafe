import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { FamilyMembershipGuard } from '../../common/guards/family-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ResolvedMembership } from '../../common/types/authenticated-request';
import { SosService } from './sos.service';
import { ArrivedDto, TriggerSosDto } from './dto/sos.dto';

@ApiTags('sos')
@ApiBearerAuth()
@UseGuards(FamilyMembershipGuard)
@Controller('families/:familyId')
export class SosController {
  constructor(private readonly sos: SosService) {}

  @Post('sos')
  @Roles(MemberRole.CHILD)
  @Audit('SOS_TRIGGERED')
  @ApiOperation({ summary: 'El menor activa el botón SOS' })
  trigger(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: TriggerSosDto,
  ) {
    return this.sos.trigger(familyId, userId, dto);
  }

  @Post('arrived')
  @Roles(MemberRole.CHILD)
  @ApiOperation({ summary: 'El menor avisa que llegó bien' })
  arrived(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ArrivedDto,
  ) {
    return this.sos.arrived(familyId, userId, dto);
  }

  @Get('sos')
  @ApiOperation({ summary: 'Historial de eventos SOS' })
  list(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentMembership() membership: ResolvedMembership,
  ) {
    return this.sos.list(familyId, membership.role, userId);
  }

  @Post('sos/:sosId/resolve')
  @Roles(MemberRole.PARENT, MemberRole.GUARDIAN)
  @Audit('SOS_RESOLVED')
  @ApiOperation({ summary: 'Marca un SOS como resuelto (tutores)' })
  resolve(
    @Param('familyId') familyId: string,
    @Param('sosId') sosId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.sos.resolve(familyId, sosId, userId);
  }
}
