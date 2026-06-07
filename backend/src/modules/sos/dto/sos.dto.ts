import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class TriggerSosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional({ description: 'Mensaje opcional del menor' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}

export class ArrivedDto {
  @ApiPropertyOptional({ description: 'Lugar/etiqueta opcional, p. ej. "Casa"' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  place?: string;
}
