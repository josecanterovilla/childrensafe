import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform!: Platform;

  @ApiProperty({ example: 'iPhone de Ana' })
  @IsString()
  @MaxLength(80)
  deviceName!: string;

  @ApiProperty({ description: 'Identificador estable del dispositivo (no publicitario)' })
  @IsString()
  @MaxLength(200)
  deviceUuid!: string;

  @ApiPropertyOptional({ description: 'Token de push (FCM/APNs)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

export class DeviceHeartbeatDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
