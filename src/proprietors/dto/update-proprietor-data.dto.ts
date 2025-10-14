import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsObject, Min } from 'class-validator';

export class GradeEnrollmentDto {
  @ApiPropertyOptional({ description: 'Number of male students', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  male?: number;

  @ApiPropertyOptional({ description: 'Number of female students', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  female?: number;
}

export class UpdateEnrollmentDto {
  @ApiProperty({ description: 'Proprietor ID' })
  @IsString()
  proprietorId: string;

  @ApiPropertyOptional({ description: 'School ID' })
  @IsString()
  @IsOptional()
  schoolId?: string;

  @ApiProperty({ description: 'Academic year (e.g., 2024/2025)', example: '2024/2025' })
  @IsString()
  academicYear: string;

  @ApiProperty({ description: 'Term', enum: ['First', 'Second', 'Third'], example: 'First' })
  @IsEnum(['First', 'Second', 'Third'])
  term: string;

  // Early Childhood
  @ApiPropertyOptional({ description: 'KG1/ECCD enrollment' })
  @IsObject()
  @IsOptional()
  kg1?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'KG2/ECCD enrollment' })
  @IsObject()
  @IsOptional()
  kg2?: GradeEnrollmentDto;

  // Nursery
  @ApiPropertyOptional({ description: 'Nursery 1 enrollment' })
  @IsObject()
  @IsOptional()
  nursery1?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Nursery 2 enrollment' })
  @IsObject()
  @IsOptional()
  nursery2?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Nursery 3 enrollment' })
  @IsObject()
  @IsOptional()
  nursery3?: GradeEnrollmentDto;

  // Primary
  @ApiPropertyOptional({ description: 'Primary 1 enrollment' })
  @IsObject()
  @IsOptional()
  primary1?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Primary 2 enrollment' })
  @IsObject()
  @IsOptional()
  primary2?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Primary 3 enrollment' })
  @IsObject()
  @IsOptional()
  primary3?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Primary 4 enrollment' })
  @IsObject()
  @IsOptional()
  primary4?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Primary 5 enrollment' })
  @IsObject()
  @IsOptional()
  primary5?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Primary 6 enrollment' })
  @IsObject()
  @IsOptional()
  primary6?: GradeEnrollmentDto;

  // Junior Secondary
  @ApiPropertyOptional({ description: 'JSS1 enrollment' })
  @IsObject()
  @IsOptional()
  jss1?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'JSS2 enrollment' })
  @IsObject()
  @IsOptional()
  jss2?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'JSS3 enrollment' })
  @IsObject()
  @IsOptional()
  jss3?: GradeEnrollmentDto;

  // Senior Secondary
  @ApiPropertyOptional({ description: 'SS1 enrollment' })
  @IsObject()
  @IsOptional()
  ss1?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'SS2 enrollment' })
  @IsObject()
  @IsOptional()
  ss2?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'SS3 enrollment' })
  @IsObject()
  @IsOptional()
  ss3?: GradeEnrollmentDto;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ description: 'Proprietor ID' })
  @IsString()
  proprietorId: string;

  @ApiPropertyOptional({ 
    description: 'Clearing status',
    enum: ['pending', 'cleared', 'outstanding']
  })
  @IsEnum(['pending', 'cleared', 'outstanding'])
  @IsOptional()
  clearingStatus?: string;

  @ApiPropertyOptional({ description: 'Total amount due' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalAmountDue?: number;

  @ApiPropertyOptional({ description: 'Amount paid' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'Payment date (ISO string)' })
  @IsString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  paymentNotes?: string;
}

export class ProprietorUpdateDto {
  @ApiPropertyOptional({ description: 'Enrollment data' })
  @IsObject()
  @IsOptional()
  enrollment?: UpdateEnrollmentDto;

  @ApiPropertyOptional({ description: 'Payment data' })
  @IsObject()
  @IsOptional()
  payment?: UpdatePaymentStatusDto;

  @ApiPropertyOptional({ description: 'Updated by (admin name/email)' })
  @IsString()
  @IsOptional()
  updatedBy?: string;
}
