import {
  Body,
  Controller,
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
import { CurrentMembership } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ResolvedMembership } from '../../common/types/authenticated-request';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, DeviceHeartbeatDto } from './dto/devices.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(FamilyMembershipGuard)
@Controller('families/:familyId/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @Audit('DEVICE_REGISTERED')
  @ApiOperation({ summary: 'Registra el dispositivo del usuario actual en la familia' })
  register(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.register(familyId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista dispositivos de la familia' })
  list(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentMembership() membership: ResolvedMembership,
  ) {
    return this.devices.list(familyId, membership.role, userId);
  }

  @Patch(':deviceId/heartbeat')
  @ApiOperation({ summary: 'Actualiza batería / token push / última conexión del propio dispositivo' })
  heartbeat(
    @Param('familyId') familyId: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: DeviceHeartbeatDto,
  ) {
    return this.devices.heartbeat(familyId, userId, deviceId, dto);
  }

  @Patch(':deviceId/revoke')
  @Roles(MemberRole.PARENT)
  @Audit('DEVICE_REVOKED')
  @ApiOperation({ summary: 'Revoca un dispositivo (solo PARENT)' })
  revoke(@Param('familyId') familyId: string, @Param('deviceId') deviceId: string) {
    return this.devices.revoke(familyId, deviceId);
  }
}
