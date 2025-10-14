import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  IsDateString,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeeStructureDto {
  @ApiPropertyOptional({ description: 'Platform fee percentage (0-100)', default: 0, minimum: 0, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  platformFeePercentage?: number;

  @ApiPropertyOptional({ description: 'Platform fixed fee in kobo', default: 0, minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  platformFeeFixed?: number;

  @ApiPropertyOptional({ description: 'Processing fee percentage (Paystack)', default: 1.5, minimum: 0, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  processingFeePercentage?: number;

  @ApiPropertyOptional({ description: 'Processing fee cap in kobo', default: 200000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  processingFeeCap?: number;

  @ApiPropertyOptional({ description: 'NAPPS share percentage (0-100)', default: 0, minimum: 0, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  nappsSharePercentage?: number;

  @ApiPropertyOptional({ description: 'NAPPS fixed share in kobo', default: 0, minimum: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  nappsShareFixed?: number;
}

export class CreateFeeConfigurationDto {
  @ApiProperty({ description: 'Fee name (e.g., "Membership Fee")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Fee code (e.g., "membership_fee")',
    enum: [
      'membership_fee',
      'registration_fee',
      'conference_fee',
      'workshop_fee',
      'certification_fee',
      'annual_dues',
      'napps_dues',
      'digital_capturing',
      'other'
    ]
  })
  @IsEnum([
    'membership_fee',
    'registration_fee',
    'conference_fee',
    'workshop_fee',
    'certification_fee',
    'annual_dues',
    'napps_dues',
    'digital_capturing',
    'other'
  ])
  code: string;

  @ApiProperty({ description: 'Base amount in Naira', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Fee description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Fee structure configuration' })
  @ValidateNested()
  @Type(() => FeeStructureDto)
  @IsOptional()
  feeStructure?: FeeStructureDto;

  @ApiPropertyOptional({ description: 'Paystack split code (e.g., SPL_xxxxxxxxxx)' })
  @IsString()
  @IsOptional()
  paystackSplitCode?: string;

  @ApiPropertyOptional({ description: 'Description of the split code configuration' })
  @IsString()
  @IsOptional()
  splitCodeDescription?: string;

  @ApiPropertyOptional({ description: 'Is this fee active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Is this a recurring fee?', default: false })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ 
    description: 'Recurring interval',
    enum: ['monthly', 'quarterly', 'annually']
  })
  @IsEnum(['monthly', 'quarterly', 'annually'])
  @IsOptional()
  recurringInterval?: string;

  @ApiPropertyOptional({ description: 'Due date for this fee' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ 
    description: 'Fee status',
    enum: ['required', 'optional'],
    default: 'required'
  })
  @IsEnum(['required', 'optional'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Minimum amount allowed', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount allowed' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  maximumAmount?: number;

  @ApiPropertyOptional({ description: 'Allow partial payments?', default: false })
  @IsBoolean()
  @IsOptional()
  allowPartialPayment?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Valid from date' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Valid until date' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}

export class UpdateFeeConfigurationDto extends PartialType(CreateFeeConfigurationDto) {
  @ApiPropertyOptional({ description: 'Admin user ID who modified this' })
  @IsString()
  @IsOptional()
  lastModifiedBy?: string;
}

export class FeeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by fee code' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by recurring status' })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ 
    description: 'Filter by status',
    enum: ['required', 'optional']
  })
  @IsEnum(['required', 'optional'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class FeeCalculationDto {
  @ApiProperty({ description: 'Fee configuration code' })
  @IsString()
  @IsNotEmpty()
  feeCode: string;

  @ApiPropertyOptional({ description: 'Custom amount (if different from configured)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  customAmount?: number;
}

export class BulkFeeUpdateDto {
  @ApiProperty({ description: 'Array of fee IDs to update' })
  @IsArray()
  @IsString({ each: true })
  feeIds: string[];

  @ApiPropertyOptional({ description: 'Update active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Update fee structure' })
  @ValidateNested()
  @Type(() => FeeStructureDto)
  @IsOptional()
  feeStructure?: FeeStructureDto;
}
