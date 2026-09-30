import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEmail, Min } from 'class-validator';

export class InitializeFidelityPaymentDto {
  @ApiProperty({ description: 'MongoDB ObjectId of the proprietor' })
  @IsNotEmpty()
  @IsString()
  proprietorId: string;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the school' })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiProperty({ description: 'Payment amount in Naira (e.g., 14500)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Type of payment (e.g., napps_dues, registration_fee, levy)' })
  @IsNotEmpty()
  @IsString()
  paymentType: string;

  @ApiProperty({ description: 'Payer email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Virtual account duration in minutes (default: 60, min: 10)' })
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class InitiateFidelityLookupPaymentDto {
  @ApiProperty({ description: 'Submission ID or proprietor MongoDB _id' })
  @IsNotEmpty()
  @IsString()
  submissionId: string;

  @ApiProperty({ description: 'Email address of proprietor' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Optional payment amount override' })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: 'Virtual account duration in minutes' })
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;
}

export class FidelityVirtualAccountDto {
  @ApiProperty({ description: '10-digit Fidelity Bank virtual account number' })
  accountNumber: string;

  @ApiProperty({ description: 'Virtual account beneficiary name' })
  accountName: string;

  @ApiProperty({ description: 'Bank Name', default: 'Fidelity Bank' })
  bankName: string;

  @ApiProperty({ description: 'Expected transfer amount in Naira' })
  amount: number;

  @ApiProperty({ description: 'Account expiration timestamp' })
  expiryTime: string;

  @ApiPropertyOptional({ description: 'Account generation / reference identifier' })
  accountGenerationId?: string;

  @ApiPropertyOptional({ description: 'Account status' })
  status?: string;
}

export class FidelityPaymentResponseDto {
  @ApiProperty({ description: 'Payment ID in database' })
  id: string;

  @ApiProperty({ description: 'Fidelity payment reference' })
  reference: string;

  @ApiProperty({ description: 'Payment gateway identifier', default: 'fidelity' })
  gateway: string;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiProperty({ description: 'Payment type' })
  paymentType: string;

  @ApiProperty({ description: 'Virtual account details', type: FidelityVirtualAccountDto })
  virtualAccount: FidelityVirtualAccountDto;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}
