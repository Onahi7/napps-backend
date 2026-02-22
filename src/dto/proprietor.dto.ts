import { IsString, IsEmail, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProprietorDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  sex?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  awards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionHeld?: string;
}

export class UpdateProprietorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  sex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  awards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionHeld?: string;
}

export class ProprietorLookupDto {
  @ApiProperty({ description: 'Email address or phone number' })
  @IsString()
  identifier: string;
}

// Step 1: Personal Information
export class SaveStep1Dto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  sex?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  awards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionHeld?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chapters?: string[];
}

// Step 2: School Information
export class SaveStep2Dto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiProperty()
  @IsString()
  schoolId: string;
}

export class Step2SchoolInfoDto {
  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pupilsPresentedLastExam?: number;
}

// Step 3: Payment Information
export class SaveStep3Dto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  finalSubmit?: boolean;

  @ApiPropertyOptional({ enum: ['paystack', 'bank_transfer', 'cash', 'online'] })
  @IsOptional()
  @IsEnum(['paystack', 'bank_transfer', 'cash', 'online'])
  paymentMethod?: string;

  @ApiPropertyOptional({ enum: ['Not Paid', 'Pending', 'Paid', 'Partially Paid'] })
  @IsOptional()
  @IsEnum(['Not Paid', 'Pending', 'Paid', 'Partially Paid'])
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalEvidence?: string;
}

export class Step3PaymentInfoDto {
  @ApiPropertyOptional({ enum: ['paystack', 'bank_transfer', 'cash', 'online'] })
  @IsOptional()
  @IsEnum(['paystack', 'bank_transfer', 'cash', 'online'])
  paymentMethod?: string;

  @ApiPropertyOptional({ enum: ['Not Paid', 'Pending', 'Paid', 'Partially Paid'] })
  @IsOptional()
  @IsEnum(['Not Paid', 'Pending', 'Paid', 'Partially Paid'])
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalEvidence?: string;

  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  approvalStatus?: string;
}

// Complete Registration (all steps)
export class CompleteRegistrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  sex?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiPropertyOptional({ enum: ['paystack', 'bank_transfer', 'cash', 'online'] })
  @IsOptional()
  @IsEnum(['paystack', 'bank_transfer', 'cash', 'online'])
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  awards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionHeld?: string;

  @ApiPropertyOptional()
  @IsOptional()
  paymentInfo?: Step3PaymentInfoDto;
}

// Chapters DTO
export class ChaptersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  chapters: string[];
}