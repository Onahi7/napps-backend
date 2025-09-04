import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSchoolDto {
  @ApiProperty()
  @IsString()
  schoolName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolName2?: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lga?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aeqeoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfEstablishment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfApproval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownership?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLatitude?: number;
}

export class UpdateSchoolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolName2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lga?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aeqeoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfEstablishment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfApproval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownership?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLatitude?: number;
}