import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ReportLocationDto {
  @ApiProperty({ example: -25.2637 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -57.5759 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'Precisión en metros' })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional({ description: 'Marca de tiempo de captura (ISO). Por defecto, ahora.' })
  @IsOptional()
  @IsString()
  recordedAt?: string;

  @ApiPropertyOptional({ description: 'UUID de idempotencia para reenvíos tras reconexión' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientEventId?: string;
}
