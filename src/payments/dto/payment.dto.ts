import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsNumber, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsMongoId, 
  IsNotEmpty,
  Min,
  IsArray,
  ValidateNested,
  IsObject,
  IsDateString,
  IsUrl
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeeBreakdownDto {
  @ApiPropertyOptional({ description: 'Platform fee in kobo', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  platformFee?: number;

  @ApiPropertyOptional({ description: 'Processing fee in kobo', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  processingFee?: number;

  @ApiPropertyOptional({ description: 'NAPPS share in kobo', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  nappsShare?: number;

  @ApiPropertyOptional({ description: 'Proprietor share in kobo', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  proprietorShare?: number;
}

export class InitializePaymentDto {
  @ApiProperty({ description: 'Proprietor ID making the payment' })
  @IsMongoId()
  @IsNotEmpty()
  proprietorId: string;

  @ApiPropertyOptional({ description: 'School ID (if payment is school-specific)' })
  @IsMongoId()
  @IsOptional()
  schoolId?: string;

  @ApiProperty({ description: 'Payer email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Payment amount in Naira' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Type of payment',
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
  paymentType: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Paystack split code (e.g., SPL_xxxxxxxxxx)' })
  @IsString()
  @IsOptional()
  splitCode?: string;

  @ApiPropertyOptional({ description: 'Fee breakdown' })
  @ValidateNested()
  @Type(() => FeeBreakdownDto)
  @IsOptional()
  feeBreakdown?: FeeBreakdownDto;

  @ApiPropertyOptional({ description: 'Callback URL after payment' })
  @IsUrl()
  @IsOptional()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Payment due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Payment reference' })
  reference: string;

  @ApiProperty({ description: 'Paystack authorization URL' })
  authorizationUrl: string;

  @ApiProperty({ description: 'Payment amount in kobo' })
  amount: number;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiProperty({ description: 'Payment type' })
  paymentType: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Paystack transaction reference' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class WebhookDto {
  @ApiProperty({ description: 'Webhook event type' })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({ description: 'Webhook data payload' })
  @IsObject()
  data: Record<string, any>;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'Amount to refund in kobo' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Merchant note' })
  @IsString()
  @IsOptional()
  merchantNote?: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by proprietor ID' })
  @IsMongoId()
  @IsOptional()
  proprietorId?: string;

  @ApiPropertyOptional({ description: 'Filter by school ID' })
  @IsMongoId()
  @IsOptional()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled']
  })
  @IsEnum(['pending', 'processing', 'success', 'failed', 'cancelled'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment type',
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
  @IsOptional()
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Start date for payment filter' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for payment filter' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum amount filter (in kobo)' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount filter (in kobo)' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['amount', 'paidAt', 'createdAt', 'reference']
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc']
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description: 'Update payment status',
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled']
  })
  @IsEnum(['pending', 'processing', 'success', 'failed', 'cancelled'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PaymentStatsDto {
  @ApiProperty({ description: 'Total number of payments' })
  totalPayments: number;

  @ApiProperty({ description: 'Total amount collected (in kobo)' })
  totalAmount: number;

  @ApiProperty({ description: 'Total amount collected (in Naira)' })
  totalAmountNaira: number;

  @ApiProperty({ description: 'Successful payments count' })
  successfulPayments: number;

  @ApiProperty({ description: 'Pending payments count' })
  pendingPayments: number;

  @ApiProperty({ description: 'Failed payments count' })
  failedPayments: number;

  @ApiProperty({ description: 'Payment breakdown by type' })
  paymentsByType: Record<string, { count: number; amount: number }>;

  @ApiProperty({ description: 'Payment breakdown by status' })
  paymentsByStatus: Record<string, number>;

  @ApiProperty({ description: 'Monthly payment trends' })
  monthlyTrends: Array<{
    month: string;
    count: number;
    amount: number;
  }>;

  @ApiProperty({ description: 'Average payment amount' })
  averageAmount: number;
}