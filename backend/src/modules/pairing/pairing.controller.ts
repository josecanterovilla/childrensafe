import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { MemberRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { FamilyMembershipGuard } from '../../common/guards/family-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { PairingService } from './pairing.service';
import { CreatePairingCodeDto, JoinFamilyDto } from './dto/pairing.dto';

@ApiTags('pairing')
@Controller()
export class PairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post('families/:familyId/pairing-codes')
  @ApiBearerAuth()
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @Audit('PAIRING_CODE_CREATED')
  @ApiOperation({ summary: 'Genera un código de emparejamiento (solo PARENT)' })
  create(
    @Param('familyId') familyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePairingCodeDto,
  ) {
    return this.pairing.createCode(familyId, userId, dto);
  }

  @Get('families/:familyId/pairing-codes')
  @ApiBearerAuth()
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @ApiOperation({ summary: 'Lista los códigos de la familia (sin revelar el código)' })
  list(@Param('familyId') familyId: string) {
    return this.pairing.listCodes(familyId);
  }

  @Post('families/:familyId/pairing-codes/:codeId/revoke')
  @ApiBearerAuth()
  @UseGuards(FamilyMembershipGuard)
  @Roles(MemberRole.PARENT)
  @Audit('PAIRING_CODE_REVOKED')
  @ApiOperation({ summary: 'Anula un código de emparejamiento (solo PARENT)' })
  revoke(@Param('familyId') familyId: string, @Param('codeId') codeId: string) {
    return this.pairing.revokeCode(familyId, codeId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pairing/join')
  @ApiOperation({ summary: 'El dispositivo del menor canjea un código para unirse a la familia' })
  join(@Body() dto: JoinFamilyDto, @Req() req: Request) {
    return this.pairing.join(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}
