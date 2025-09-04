import { IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSchoolEnrollmentDto {
  @ApiProperty({ default: '2024/2025' })
  @IsString()
  academicYear: string;

  // Nursery Enrollment
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery1Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery1Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery2Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery2Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery3Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nursery3Female?: number;

  // Kindergarten Enrollment
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kg1Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kg1Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kg2Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kg2Female?: number;

  // Primary Enrollment (1-6)
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary1Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary1Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary2Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary2Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary3Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary3Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary4Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary4Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary5Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary5Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary6Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  primary6Female?: number;

  // Secondary Enrollment (JSS 1-3, SS 1-3)
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss1Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss1Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss2Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss2Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss3Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jss3Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss1Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss1Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss2Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss2Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss3Male?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ss3Female?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pupilsPresented2023?: number;
}

export class UpdateSchoolEnrollmentDto extends CreateSchoolEnrollmentDto {}