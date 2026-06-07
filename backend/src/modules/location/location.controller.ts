import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MemberRole } from '@prisma/client';
import { FamilyMembershipGuard } from '../../common/guards/family-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ResolvedMembership } from '../../common/types/authenticated-request';
import { LocationService } from './location.service';
import { ReportLocationDto } from './dto/location.dto';

@ApiTags('location')
@ApiBearerAuth()
@UseGuards(FamilyMembershipGuard)
@Controller('families/:familyId')
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Post('location')
  @Roles(MemberRole.CHILD)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'El menor reporta su ubicación' })
  report(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ReportLocationDto,
  ) {
    return this.location.report(familyId, userId, dto);
  }

  @Get('children/:childId/location/latest')
  @ApiOperation({ summary: 'Última ubicación conocida de un menor' })
  latest(
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
    @CurrentUser('userId') userId: string,
    @CurrentMembership() membership: ResolvedMembership,
  ) {
    return this.location.latest(familyId, childId, membership.role, userId);
  }

  @Get('children/:childId/location/history')
  @ApiOperation({ summary: 'Historial reciente de ubicaciones (con retención limitada)' })
  history(
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
    @CurrentUser('userId') userId: string,
    @CurrentMembership() membership: ResolvedMembership,
    @Query('limit') limit?: string,
  ) {
    return this.location.history(
      familyId,
      childId,
      membership.role,
      userId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
