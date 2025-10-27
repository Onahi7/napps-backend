import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsPhoneNumber, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsNumber, 
  IsDateString,
  IsObject,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsArray
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NAPPS_CHAPTERS } from '../../common/constants/napps-chapters';
import type { NappsChapter } from '../../common/constants/napps-chapters';

export class CreateProprietorDto {
  @ApiProperty({ description: 'First name of the proprietor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiPropertyOptional({ description: 'Middle name of the proprietor' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  middleName?: string;

  @ApiProperty({ description: 'Last name of the proprietor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ 
    enum: ['Male', 'Female'], 
    description: 'Gender of the proprietor' 
  })
  @IsEnum(['Male', 'Female'])
  @IsOptional()
  sex?: string;

  @ApiProperty({ description: 'Email address of the proprietor' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number of the proprietor' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'NAPPS membership ID' })
  @IsString()
  @IsOptional()
  nappsMembershipId?: string;

  @ApiPropertyOptional({ 
    enum: ['pending', 'approved', 'suspended', 'rejected'],
    description: 'Registration status',
    default: 'pending'
  })
  @IsEnum(['pending', 'approved', 'suspended', 'rejected'])
  @IsOptional()
  registrationStatus?: string;

  @ApiPropertyOptional({ 
    enum: ['pending', 'approved', 'rejected'],
    description: 'Approval status',
    default: 'pending'
  })
  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  approvalStatus?: string;

  @ApiPropertyOptional({ 
    enum: ['Not Registered', 'Registered', 'Registered with Certificate'],
    description: 'NAPPS registration status',
    default: 'Not Registered'
  })
  @IsEnum(['Not Registered', 'Registered', 'Registered with Certificate'])
  @IsOptional()
  nappsRegistered?: string;

  @ApiPropertyOptional({ 
    example: ['Lafia A', 'Keffi'], 
    enum: NAPPS_CHAPTERS,
    isArray: true,
    description: 'NAPPS chapters assigned to this proprietor'
  })
  @IsArray()
  @IsEnum(NAPPS_CHAPTERS, { each: true })
  @IsOptional()
  chapters?: NappsChapter[];

  @ApiPropertyOptional({ description: 'Participation history object' })
  @IsObject()
  @IsOptional()
  participationHistory?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Awards received' })
  @IsString()
  @IsOptional()
  awards?: string;

  @ApiPropertyOptional({ description: 'Position held' })
  @IsString()
  @IsOptional()
  positionHeld?: string;

  @ApiPropertyOptional({ 
    enum: ['pending', 'cleared', 'outstanding'],
    description: 'Clearing status',
    default: 'pending'
  })
  @IsEnum(['pending', 'cleared', 'outstanding'])
  @IsOptional()
  clearingStatus?: string;

  @ApiPropertyOptional({ description: 'Total amount due', default: 0 })
  @IsNumber()
  @IsOptional()
  totalAmountDue?: number;

  @ApiPropertyOptional({ description: 'Last payment date' })
  @IsDateString()
  @IsOptional()
  lastPaymentDate?: string;

  @ApiPropertyOptional({ description: 'Submission ID' })
  @IsString()
  @IsOptional()
  submissionId?: string;

  @ApiPropertyOptional({ 
    enum: ['draft', 'submitted', 'processed', 'archived'],
    description: 'Submission status',
    default: 'submitted'
  })
  @IsEnum(['draft', 'submitted', 'processed', 'archived'])
  @IsOptional()
  submissionStatus?: string;

  @ApiPropertyOptional({ description: 'Is active status', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProprietorDto extends PartialType(CreateProprietorDto) {}

export class ProprietorLookupDto {
  @ApiPropertyOptional({ description: 'Email address for lookup' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number for lookup' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Registration number for lookup' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'NAPPS membership ID for lookup' })
  @IsString()
  @IsOptional()
  nappsMembershipId?: string;

  @ApiPropertyOptional({ description: 'School name for lookup' })
  @IsString()
  @IsOptional()
  schoolName?: string;

  @ApiPropertyOptional({ description: 'Proprietor first name for lookup' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Proprietor last name for lookup' })
  @IsString()
  @IsOptional()
  lastName?: string;
}

export class ProprietorQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ 
    enum: ['pending', 'approved', 'suspended', 'rejected'],
    description: 'Filter by registration status' 
  })
  @IsEnum(['pending', 'approved', 'suspended', 'rejected'])
  @IsOptional()
  registrationStatus?: string;

  @ApiPropertyOptional({ 
    enum: ['Not Registered', 'Registered', 'Registered with Certificate'],
    description: 'Filter by NAPPS registration status' 
  })
  @IsEnum(['Not Registered', 'Registered', 'Registered with Certificate'])
  @IsOptional()
  nappsRegistered?: string;

  @ApiPropertyOptional({ 
    enum: ['pending', 'cleared', 'outstanding'],
    description: 'Filter by clearing status' 
  })
  @IsEnum(['pending', 'cleared', 'outstanding'])
  @IsOptional()
  clearingStatus?: string;

  @ApiPropertyOptional({ description: 'Filter active/inactive' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    enum: ['firstName', 'lastName', 'email', 'createdAt', 'totalAmountDue'],
    description: 'Sort by field',
    default: 'createdAt'
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ 
    enum: ['asc', 'desc'],
    description: 'Sort order',
    default: 'desc'
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class CsvImportDto {
  @ApiProperty({ 
    type: 'string', 
    format: 'binary',
    description: 'CSV file to import' 
  })
  file: any;

  @ApiPropertyOptional({ 
    description: 'Skip validation for existing records',
    default: false 
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  skipValidation?: boolean;

  @ApiPropertyOptional({ 
    description: 'Update existing records if found',
    default: false 
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean;
}

export class CsvImportResultDto {
  @ApiProperty({ description: 'Total number of records processed' })
  totalRecords: number;

  @ApiProperty({ description: 'Number of successfully imported records' })
  successCount: number;

  @ApiProperty({ description: 'Number of failed imports' })
  errorCount: number;

  @ApiProperty({ description: 'Number of skipped records' })
  skippedCount: number;

  @ApiProperty({ description: 'List of errors encountered' })
  errors: Array<{
    row: number;
    field: string;
    value: any;
    message: string;
  }>;

  @ApiProperty({ description: 'List of warnings' })
  warnings: Array<{
    row: number;
    message: string;
  }>;

  @ApiProperty({ description: 'Import summary' })
  summary: {
    newRecords: number;
    updatedRecords: number;
    duplicates: number;
  };
}