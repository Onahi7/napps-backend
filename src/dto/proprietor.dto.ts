import { IsString, IsEmail, IsOptional, IsEnum, IsArray, IsNumber, IsObject, IsBoolean, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
  lga?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @ApiPropertyOptional({ enum: ['Not Registered', 'Registered', 'Registered with Certificate'] })
  @IsOptional()
  @IsEnum(['Not Registered', 'Registered', 'Registered with Certificate'])
  nappsRegistered?: string;

  @ApiPropertyOptional()
  @IsOptional()
  participationHistory?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timesParticipated?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pupilsPresentedLastExam?: number;

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

// Enrollment data DTO
export class EnrollmentDto {
  @IsOptional() @IsNumber() kg1Male?: number;
  @IsOptional() @IsNumber() kg1Female?: number;
  @IsOptional() @IsNumber() kg2Male?: number;
  @IsOptional() @IsNumber() kg2Female?: number;
  @IsOptional() @IsNumber() eccdMale?: number;
  @IsOptional() @IsNumber() eccdFemale?: number;
  @IsOptional() @IsNumber() nursery1Male?: number;
  @IsOptional() @IsNumber() nursery1Female?: number;
  @IsOptional() @IsNumber() nursery2Male?: number;
  @IsOptional() @IsNumber() nursery2Female?: number;
  @IsOptional() @IsNumber() primary1Male?: number;
  @IsOptional() @IsNumber() primary1Female?: number;
  @IsOptional() @IsNumber() primary2Male?: number;
  @IsOptional() @IsNumber() primary2Female?: number;
  @IsOptional() @IsNumber() primary3Male?: number;
  @IsOptional() @IsNumber() primary3Female?: number;
  @IsOptional() @IsNumber() primary4Male?: number;
  @IsOptional() @IsNumber() primary4Female?: number;
  @IsOptional() @IsNumber() primary5Male?: number;
  @IsOptional() @IsNumber() primary5Female?: number;
  @IsOptional() @IsNumber() primary6Male?: number;
  @IsOptional() @IsNumber() primary6Female?: number;
  @IsOptional() @IsNumber() jss1Male?: number;
  @IsOptional() @IsNumber() jss1Female?: number;
  @IsOptional() @IsNumber() jss2Male?: number;
  @IsOptional() @IsNumber() jss2Female?: number;
  @IsOptional() @IsNumber() jss3Male?: number;
  @IsOptional() @IsNumber() jss3Female?: number;
  @IsOptional() @IsNumber() ss1Male?: number;
  @IsOptional() @IsNumber() ss1Female?: number;
  @IsOptional() @IsNumber() ss2Male?: number;
  @IsOptional() @IsNumber() ss2Female?: number;
  @IsOptional() @IsNumber() ss3Male?: number;
  @IsOptional() @IsNumber() ss3Female?: number;
}

// Step 2: School Information
export class SaveStep2Dto {
  @ApiProperty()
  @IsString()
  submissionId: string;

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
  chapter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aeqeoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownership?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  yearOfEstablishment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  yearOfApproval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationEvidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationEvidencePhoto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentDto)
  @IsObject()
  enrollment?: EnrollmentDto;
}

export class Step2SchoolInfoDto {
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
  chapter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aeqeoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryOfSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownership?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  yearOfEstablishment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  yearOfApproval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationEvidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationEvidencePhoto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollmentDto)
  @IsObject()
  enrollment?: EnrollmentDto;

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