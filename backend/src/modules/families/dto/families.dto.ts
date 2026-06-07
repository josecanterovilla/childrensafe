import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFamilyDto {
  @ApiProperty({ example: 'Familia Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class RenameFamilyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: MemberRole })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiPropertyOptional({
    description: 'Permisos finos para GUARDIAN',
    example: { viewLocation: true, manageRules: false },
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;
}
