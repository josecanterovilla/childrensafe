import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { GeofenceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Casa' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: GeofenceType, default: GeofenceType.CUSTOM })
  @IsEnum(GeofenceType)
  type!: GeofenceType;

  @ApiProperty({ example: -25.2637 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -57.5759 })
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ description: 'Radio en metros', minimum: 50, maximum: 50000, example: 150 })
  @IsInt()
  @Min(50)
  @Max(50_000)
  radiusM!: number;

  @ApiPropertyOptional({ description: 'Si se omite, aplica a todos los menores de la familia' })
  @IsOptional()
  @IsUUID()
  childProfileId?: string;

  @ApiPropertyOptional({ description: 'Horario de vigencia opcional (JSON libre)' })
  @IsOptional()
  schedule?: Record<string, unknown>;
}

export class UpdateGeofenceDto extends PartialType(CreateGeofenceDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
