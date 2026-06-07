import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertStatus } from '@prisma/client';
import { FamilyMembershipGuard } from '../../common/guards/family-membership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(FamilyMembershipGuard)
@Controller('families/:familyId/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las alertas de la familia' })
  list(@Param('familyId') familyId: string, @Query('status') status?: AlertStatus) {
    return this.alerts.list(familyId, status);
  }

  @Post(':alertId/acknowledge')
  @Audit('ALERT_ACKNOWLEDGED')
  @ApiOperation({ summary: 'Marca una alerta como vista' })
  acknowledge(
    @Param('familyId') familyId: string,
    @Param('alertId') alertId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.alerts.acknowledge(familyId, alertId, userId);
  }
}
