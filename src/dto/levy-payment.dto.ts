import { 
  IsString, 
  IsEmail, 
  IsNotEmpty, 
  IsOptional, 
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NAPPS_CHAPTERS } from '../common/constants/napps-chapters';

export class InitializeLevyPaymentDto {
  @ApiPropertyOptional({ description: 'Proprietor ID (optional, will auto-link by email/phone)' })
  @IsString()
  @IsOptional()
  proprietorId?: string;

  @ApiProperty({ description: 'Member name' })
  @IsString()
  @IsNotEmpty()
  memberName: string;

  @ApiProperty({ description: 'Member email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Member phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'NAPPS chapter', enum: NAPPS_CHAPTERS })
  @IsEnum(NAPPS_CHAPTERS)
  @IsNotEmpty()
  chapter: string;

  @ApiProperty({ description: 'School name' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiPropertyOptional({ description: 'Whether school name was manually entered' })
  @IsBoolean()
  @IsOptional()
  isManualSchoolEntry?: boolean;

  @ApiProperty({ description: 'List of wards', type: [String] })
  @IsArray()
  @IsString({ each: true })
  wards: string[];

  @ApiPropertyOptional({ description: 'Payment amount in Naira', default: 5250 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Previous payment reference for continuation' })
  @IsString()
  @IsOptional()
  previousPaymentReference?: string;

  @ApiPropertyOptional({ description: 'Is this a continuation of a previous payment' })
  @IsBoolean()
  @IsOptional()
  isContinuation?: boolean;

  @ApiPropertyOptional({ description: 'Callback URL after payment' })
  @IsString()
  @IsOptional()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class VerifyLevyPaymentDto {
  @ApiProperty({ description: 'Payment reference' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class CheckDuplicateDto {
  @ApiPropertyOptional({ description: 'Email to check' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number to check' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class LevyPaymentQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by proprietor ID' })
  @IsString()
  @IsOptional()
  proprietorId?: string;

  @ApiPropertyOptional({ description: 'Filter by chapter' })
  @IsString()
  @IsOptional()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsEnum(['pending', 'processing', 'success', 'failed', 'refunded'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by phone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)' })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['asc', 'desc'],
    default: 'desc' 
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class GenerateReceiptDto {
  @ApiProperty({ description: 'Payment reference' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class DownloadReceiptDto {
  @ApiPropertyOptional({ description: 'Email or phone number' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
