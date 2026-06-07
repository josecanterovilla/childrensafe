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
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto, UpdateGeofenceDto } from './dto/geofences.dto';

@ApiTags('geofences')
@ApiBearerAuth()
@UseGuards(FamilyMembershipGuard)
@Controller('families/:familyId/geofences')
export class GeofencesController {
  constructor(private readonly geofences: GeofencesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las geocercas de la familia' })
  list(@Param('familyId') familyId: string) {
    return this.geofences.list(familyId);
  }

  @Post()
  @Roles(MemberRole.PARENT, MemberRole.GUARDIAN)
  @Audit('GEOFENCE_CREATED')
  @ApiOperation({ summary: 'Crea una geocerca (tutores)' })
  create(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateGeofenceDto,
  ) {
    return this.geofences.create(familyId, userId, dto);
  }

  @Patch(':geofenceId')
  @Roles(MemberRole.PARENT, MemberRole.GUARDIAN)
  @Audit('GEOFENCE_UPDATED')
  @ApiOperation({ summary: 'Actualiza una geocerca (tutores)' })
  update(
    @Param('familyId') familyId: string,
    @Param('geofenceId') geofenceId: string,
    @Body() dto: UpdateGeofenceDto,
  ) {
    return this.geofences.update(familyId, geofenceId, dto);
  }

  @Delete(':geofenceId')
  @Roles(MemberRole.PARENT)
  @Audit('GEOFENCE_DELETED')
  @ApiOperation({ summary: 'Elimina una geocerca (solo PARENT)' })
  remove(@Param('familyId') familyId: string, @Param('geofenceId') geofenceId: string) {
    return this.geofences.remove(familyId, geofenceId);
  }
}
