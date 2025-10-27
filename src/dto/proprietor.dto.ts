import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NASARAWA_LGAS } from '../common/constants/nasarawa-lgas';
import type { NasarawaLga } from '../common/constants/nasarawa-lgas';
import { NAPPS_CHAPTERS } from '../common/constants/napps-chapters';
import type { NappsChapter } from '../common/constants/napps-chapters';

// STEP 1: Personal Information DTO
export class Step1PersonalInfoDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ example: 'Michael' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'Male', enum: ['Male', 'Female'] })
  @IsEnum(['Male', 'Female'])
  sex: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Lafia', enum: NASARAWA_LGAS })
  @IsEnum(NASARAWA_LGAS)
  lga: NasarawaLga;

  @ApiPropertyOptional({ 
    example: ['Lafia A', 'Lafia B'], 
    enum: NAPPS_CHAPTERS,
    isArray: true,
    description: 'NAPPS chapters assigned to this proprietor'
  })
  @IsArray()
  @IsEnum(NAPPS_CHAPTERS, { each: true })
  @IsOptional()
  chapters?: NappsChapter[];

  @ApiPropertyOptional({ example: 'Registered with Certificate', enum: ['Not Registered', 'Registered', 'Registered with Certificate'] })
  @IsEnum(['Not Registered', 'Registered', 'Registered with Certificate'])
  @IsOptional()
  nappsRegistered?: string;

  @ApiPropertyOptional({ example: ['National: 2023/2024, 2024/2025', 'State: 2023/2024'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participationHistory?: string[];

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  timesParticipated?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsNumber()
  @IsOptional()
  pupilsPresentedLastExam?: number;

  @ApiPropertyOptional({ example: 'Best School Award 2023' })
  @IsString()
  @IsOptional()
  awards?: string;

  @ApiPropertyOptional({ example: 'Zonal Chairman' })
  @IsString()
  @IsOptional()
  positionHeld?: string;
}

// Enrollment Data DTO for Step 2
export class EnrollmentDataDto {
  // Kindergarten
  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  kg1Male?: number;

  @ApiPropertyOptional({ example: 8, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  kg1Female?: number;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  kg2Male?: number;

  @ApiPropertyOptional({ example: 15, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  kg2Female?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  eccdMale?: number;

  @ApiPropertyOptional({ example: 7, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  eccdFemale?: number;

  // Nursery
  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  nursery1Male?: number;

  @ApiPropertyOptional({ example: 18, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  nursery1Female?: number;

  @ApiPropertyOptional({ example: 22, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  nursery2Male?: number;

  @ApiPropertyOptional({ example: 25, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  nursery2Female?: number;

  // Primary (1-6)
  @ApiPropertyOptional({ example: 30, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary1Male?: number;

  @ApiPropertyOptional({ example: 28, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary1Female?: number;

  @ApiPropertyOptional({ example: 32, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary2Male?: number;

  @ApiPropertyOptional({ example: 30, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary2Female?: number;

  @ApiPropertyOptional({ example: 35, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary3Male?: number;

  @ApiPropertyOptional({ example: 33, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary3Female?: number;

  @ApiPropertyOptional({ example: 28, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary4Male?: number;

  @ApiPropertyOptional({ example: 30, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary4Female?: number;

  @ApiPropertyOptional({ example: 25, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary5Male?: number;

  @ApiPropertyOptional({ example: 27, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary5Female?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary6Male?: number;

  @ApiPropertyOptional({ example: 22, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  primary6Female?: number;

  // Junior Secondary (JSS 1-3)
  @ApiPropertyOptional({ example: 18, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss1Male?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss1Female?: number;

  @ApiPropertyOptional({ example: 15, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss2Male?: number;

  @ApiPropertyOptional({ example: 17, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss2Female?: number;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss3Male?: number;

  @ApiPropertyOptional({ example: 14, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  jss3Female?: number;

  // Senior Secondary (SS 1-3)
  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss1Male?: number;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss1Female?: number;

  @ApiPropertyOptional({ example: 8, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss2Male?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss2Female?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss3Male?: number;

  @ApiPropertyOptional({ example: 7, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ss3Female?: number;
}

// STEP 2: School Information & Enrollment DTO
export class Step2SchoolInfoDto {
  @ApiProperty({ example: 'Excellence International School' })
  @IsString()
  schoolName: string;

  @ApiPropertyOptional({ example: 'EIS Annex' })
  @IsString()
  @IsOptional()
  schoolName2?: string;

  @ApiProperty({ example: '123 Main Street, Lafia' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: 'Near Central Market' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Lafia' })
  @IsString()
  @IsOptional()
  lga?: string;

  @ApiPropertyOptional({ example: 'Zone A' })
  @IsString()
  @IsOptional()
  aeqeoZone?: string;

  @ApiPropertyOptional({ example: 8.5123456 })
  @IsNumber()
  @IsOptional()
  gpsLongitude?: number;

  @ApiPropertyOptional({ example: 9.4567890 })
  @IsNumber()
  @IsOptional()
  gpsLatitude?: number;

  @ApiPropertyOptional({ example: 'Faith Based', enum: ['Faith Based', 'Conventional', 'Islamiyah Integrated', 'Secular', 'Other'] })
  @IsEnum(['Faith Based', 'Conventional', 'Islamiyah Integrated', 'Secular', 'Other'])
  @IsOptional()
  typeOfSchool?: string;

  @ApiPropertyOptional({ example: 'Private' })
  @IsString()
  @IsOptional()
  categoryOfSchool?: string;

  @ApiPropertyOptional({ example: 'Individual(s)', enum: ['Individual(s)', 'Sole', 'Partnership', 'Corporate', 'Community', 'Religious Organization', 'Other'] })
  @IsEnum(['Individual(s)', 'Sole', 'Partnership', 'Corporate', 'Community', 'Religious Organization', 'Other'])
  @IsOptional()
  ownership?: string;

  @ApiPropertyOptional({ example: 2010, minimum: 1900, maximum: 2100 })
  @IsNumber()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  yearOfEstablishment?: number;

  @ApiPropertyOptional({ example: 2012, minimum: 1900, maximum: 2100 })
  @IsNumber()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  yearOfApproval?: number;

  @ApiPropertyOptional({ example: 'Certificate of Registration #12345' })
  @IsString()
  @IsOptional()
  registrationEvidence?: string;

  @ApiPropertyOptional({ type: EnrollmentDataDto })
  @ValidateNested()
  @Type(() => EnrollmentDataDto)
  @IsOptional()
  enrollment?: EnrollmentDataDto;
}

// STEP 3: Payment & Verification DTO
export class Step3PaymentInfoDto {
  @ApiPropertyOptional({ example: 'Digital Capturing' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'Pending' })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ example: 'Cleared', enum: ['pending', 'cleared', 'outstanding'] })
  @IsEnum(['pending', 'cleared', 'outstanding'])
  @IsOptional()
  clearingStatus?: string;

  @ApiPropertyOptional({ example: 'Approved' })
  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  approvalStatus?: string;

  @ApiPropertyOptional({ example: 'Approval Letter #456' })
  @IsString()
  @IsOptional()
  approvalEvidence?: string;
}

// Complete Registration DTO (combines all 3 steps)
export class CompleteRegistrationDto {
  @ApiProperty({ example: 'SUB123456' })
  @IsString()
  submissionId: string;

  @ApiProperty({ type: Step1PersonalInfoDto })
  @ValidateNested()
  @Type(() => Step1PersonalInfoDto)
  personalInfo: Step1PersonalInfoDto;

  @ApiProperty({ type: Step2SchoolInfoDto })
  @ValidateNested()
  @Type(() => Step2SchoolInfoDto)
  schoolInfo: Step2SchoolInfoDto;

  @ApiPropertyOptional({ type: Step3PaymentInfoDto })
  @ValidateNested()
  @Type(() => Step3PaymentInfoDto)
  @IsOptional()
  paymentInfo?: Step3PaymentInfoDto;
}

// Separate endpoint DTOs for saving each step
export class SaveStep1Dto extends Step1PersonalInfoDto {
  @ApiPropertyOptional({ example: 'SUB123456' })
  @IsString()
  @IsOptional()
  submissionId?: string;
}

export class SaveStep2Dto extends Step2SchoolInfoDto {
  @ApiProperty({ example: 'SUB123456' })
  @IsString()
  submissionId: string;
}

export class SaveStep3Dto extends Step3PaymentInfoDto {
  @ApiProperty({ example: 'SUB123456' })
  @IsString()
  submissionId: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  finalSubmit?: boolean;
}

// Original DTOs for backward compatibility
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