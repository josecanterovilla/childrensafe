import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgeBand, Platform } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePairingCodeDto {
  @ApiProperty({ description: 'Nombre del menor que se mostrará en la familia', example: 'Lucía' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  childDisplayName!: string;

  @ApiProperty({ enum: AgeBand, description: 'Rango de edad para aplicar reglas por etapa' })
  @IsEnum(AgeBand)
  childAgeBand!: AgeBand;
}

class JoinDeviceDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform!: Platform;

  @ApiProperty({ example: 'Android de Lucía' })
  @IsString()
  @MaxLength(80)
  deviceName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  deviceUuid!: string;

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

export class JoinFamilyDto {
  @ApiProperty({ description: 'Código de emparejamiento (XXXX-XXXX)', example: 'JX4K-82MZ' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: 'Nombre con el que el menor quiere mostrarse (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiProperty({ type: JoinDeviceDto })
  @ValidateNested()
  @Type(() => JoinDeviceDto)
  device!: JoinDeviceDto;
}
