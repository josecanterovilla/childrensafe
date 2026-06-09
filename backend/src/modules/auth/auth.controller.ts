import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  LogoutDto,
  MfaCodeDto,
  MfaDisableDto,
  RefreshDto,
  RegisterDto,
  ResendCodeDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registra un tutor y envía un código de confirmación al correo' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @ApiOperation({ summary: 'Confirma el correo con el código y emite tokens' })
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.email, dto.code, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('resend-code')
  @ApiOperation({ summary: 'Reenvía un código de confirmación o de recuperación' })
  resendCode(@Body() dto: ResendCodeDto) {
    return this.auth.resendCode(dto.email, dto.purpose);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión (con MFA opcional)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('google')
  @ApiOperation({ summary: 'Inicia sesión con Google (ID token); crea o enlaza la cuenta del tutor' })
  google(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.auth.loginWithGoogle(dto.idToken, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rota el par de tokens usando el refresh token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoca el refresh token (cierra la sesión)' })
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicita un enlace de recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto.email, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset-password')
  @ApiOperation({ summary: 'Restablece la contraseña con el código recibido' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('change-password')
  @ApiOperation({ summary: 'Cambia la contraseña (reautentica con la actual)' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('mfa/setup')
  @ApiOperation({ summary: 'Inicia la configuración de MFA (devuelve secreto y otpauth URL)' })
  mfaSetup(@CurrentUser('userId') userId: string) {
    return this.auth.mfaSetup(userId);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('mfa/enable')
  @ApiOperation({ summary: 'Activa MFA verificando un código TOTP' })
  mfaEnable(@CurrentUser('userId') userId: string, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable(userId, dto.code);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('mfa/disable')
  @ApiOperation({ summary: 'Desactiva MFA (reautentica con contraseña + código)' })
  mfaDisable(@CurrentUser('userId') userId: string, @Body() dto: MfaDisableDto) {
    return this.auth.mfaDisable(userId, dto.password, dto.code);
  }
}
