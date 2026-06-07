import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/account.dto';

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  @ApiOperation({ summary: 'Exporta todos los datos del usuario y sus familias (GDPR)' })
  export(@CurrentUser('userId') userId: string) {
    return this.account.exportData(userId);
  }

  @Post('delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina la cuenta (reautentica con contraseña) — GDPR' })
  remove(@CurrentUser('userId') userId: string, @Body() dto: DeleteAccountDto) {
    return this.account.deleteAccount(userId, dto.password);
  }
}
