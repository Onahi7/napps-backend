import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsNumber, IsObject } from 'class-validator';

export class CreateCenterDto {
  @ApiProperty({ example: 'NAS-C01' })
  @IsString()
  @IsNotEmpty()
  centerCode: string;

  @ApiProperty({ example: 'Lafia Central Examination Center' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Lafia' })
  @IsString()
  @IsNotEmpty()
  lga: string;

  @ApiProperty({ example: 'Shendam Road, Lafia' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiProperty({ example: 'Dr. Ibrahim Aliyu' })
  @IsString()
  @IsNotEmpty()
  supervisorName: string;

  @ApiProperty({ example: '+2348023456789' })
  @IsString()
  @IsNotEmpty()
  supervisorPhone: string;
}

export class RegisterCandidateDto {
  @ApiProperty({ example: 'Maryam Umar Danladi' })
  @IsString()
  @IsNotEmpty()
  candidateName: string;

  @ApiProperty({ enum: ['Male', 'Female'], example: 'Female' })
  @IsEnum(['Male', 'Female'])
  gender: string;

  @ApiProperty({ example: 'Standard Academy Lafia' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiProperty({ example: 'NAS-C01' })
  @IsString()
  @IsNotEmpty()
  centerCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @ApiPropertyOptional({ example: ['English Language', 'Mathematics', 'Basic Science & Tech', 'National Values', 'Pre-Vocational Studies'] })
  @IsOptional()
  @IsArray()
  subjects?: string[];
}

export class ProcessOmrScanDto {
  @ApiProperty({ example: 'NNSUCE/2026/01/0014' })
  @IsString()
  @IsNotEmpty()
  examNumber: string;

  @ApiProperty({ example: 'English Language' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'NAS-C01' })
  @IsString()
  @IsNotEmpty()
  centerCode: string;

  @ApiPropertyOptional({ description: 'Base64 image or URL of scanned answer sheet' })
  @IsOptional()
  @IsString()
  sheetImage?: string;

  @ApiProperty({ description: 'Bubble marks detected by optical/AI scanner: array of marked option per question 1..50 (A, B, C, D, or MULTIPLE, or BLANK)' })
  @IsArray()
  detectedResponses: string[];

  @ApiPropertyOptional({ description: 'Optional scanner device metadata' })
  @IsOptional()
  @IsString()
  scannerDevice?: string;
}

export class GenerateExamSheetDto {
  @ApiPropertyOptional({ example: 'NNSUCE/2026/01/0014' })
  @IsOptional()
  @IsString()
  examNumber?: string;

  @ApiPropertyOptional({ example: 'NAS-C01' })
  @IsOptional()
  @IsString()
  centerCode?: string;

  @ApiPropertyOptional({ example: 'English Language' })
  @IsOptional()
  @IsString()
  subject?: string;
}
