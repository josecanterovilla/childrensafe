import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailCodePurpose } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'una-contraseña-fuerte', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;

  @ApiPropertyOptional({ description: 'Nombre de la familia a crear con la cuenta', example: 'Familia Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  familyName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ description: 'Código TOTP si la cuenta tiene MFA activado' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class GoogleLoginDto {
  @ApiProperty({ description: 'ID token de Google obtenido por la app (Google Sign-In)' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Código de 6 dígitos recibido por correo', example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: EmailCodePurpose, example: EmailCodePurpose.VERIFY_EMAIL })
  @IsEnum(EmailCodePurpose)
  purpose!: EmailCodePurpose;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'madre@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Código de 6 dígitos recibido por correo', example: '482913' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

export class MfaCodeDto {
  @ApiProperty({ description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class MfaDisableDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
