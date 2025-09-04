import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsMongoId, 
  IsNotEmpty,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsArray,
  IsUrl,
  IsEnum,
  ValidateNested,
  IsObject
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateSchoolDto {
  @ApiProperty({ description: 'Proprietor ID who owns this school' })
  @IsMongoId()
  @IsNotEmpty()
  proprietorId: string;

  @ApiProperty({ description: 'Primary name of the school' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  schoolName: string;

  @ApiPropertyOptional({ description: 'Alternative/Secondary name of the school' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  schoolName2?: string;

  @ApiProperty({ description: 'Primary address of the school' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  address: string;

  @ApiPropertyOptional({ description: 'Additional address line' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'Local Government Area' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lga?: string;

  @ApiPropertyOptional({ description: 'AEQEO Zone' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  aeqeoZone?: string;

  @ApiPropertyOptional({ description: 'Year school was established' })
  @IsNumber()
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfEstablishment?: number;

  @ApiPropertyOptional({ description: 'Year school got official approval' })
  @IsNumber()
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearOfApproval?: number;

  @ApiPropertyOptional({ description: 'Type of school (e.g., Faith Based, Secular)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  typeOfSchool?: string;

  @ApiPropertyOptional({ 
    description: 'Category of school',
    default: 'Private'
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  categoryOfSchool?: string;

  @ApiPropertyOptional({ description: 'Ownership type (e.g., Individual(s), Corporate)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  ownership?: string;

  @ApiPropertyOptional({ description: 'GPS Longitude coordinate' })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  gpsLongitude?: number;

  @ApiPropertyOptional({ description: 'GPS Latitude coordinate' })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  gpsLatitude?: number;

  @ApiPropertyOptional({ 
    description: 'Whether this is the primary school for the proprietor',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Array of image URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @ApiPropertyOptional({ description: 'Active status of the school' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Enrollment DTOs
export class EnrollmentByLevelDto {
  @ApiPropertyOptional({ description: 'Nursery 1 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  nursery1?: number;

  @ApiPropertyOptional({ description: 'Nursery 2 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  nursery2?: number;

  @ApiPropertyOptional({ description: 'Kindergarten enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  kindergarten?: number;

  @ApiPropertyOptional({ description: 'Primary 1 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary1?: number;

  @ApiPropertyOptional({ description: 'Primary 2 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary2?: number;

  @ApiPropertyOptional({ description: 'Primary 3 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary3?: number;

  @ApiPropertyOptional({ description: 'Primary 4 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary4?: number;

  @ApiPropertyOptional({ description: 'Primary 5 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary5?: number;

  @ApiPropertyOptional({ description: 'Primary 6 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  primary6?: number;

  @ApiPropertyOptional({ description: 'JSS 1 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  jss1?: number;

  @ApiPropertyOptional({ description: 'JSS 2 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  jss2?: number;

  @ApiPropertyOptional({ description: 'JSS 3 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  jss3?: number;

  @ApiPropertyOptional({ description: 'SS 1 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  ss1?: number;

  @ApiPropertyOptional({ description: 'SS 2 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  ss2?: number;

  @ApiPropertyOptional({ description: 'SS 3 enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  ss3?: number;

  @ApiPropertyOptional({ description: 'Special classes enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  special?: number;

  @ApiPropertyOptional({ description: 'Other classes enrollment' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  others?: number;
}

export class GenderBreakdownDto {
  @ApiProperty({ description: 'Number of male students' })
  @IsNumber()
  @Min(0)
  male: number;

  @ApiProperty({ description: 'Number of female students' })
  @IsNumber()
  @Min(0)
  female: number;
}

export class StaffDataDto {
  @ApiProperty({ description: 'Number of teaching staff' })
  @IsNumber()
  @Min(0)
  teachingStaff: number;

  @ApiProperty({ description: 'Number of non-teaching staff' })
  @IsNumber()
  @Min(0)
  nonTeachingStaff: number;

  @ApiProperty({ description: 'Number of qualified teachers' })
  @IsNumber()
  @Min(0)
  qualifiedTeachers: number;

  @ApiProperty({ description: 'Number of unqualified teachers' })
  @IsNumber()
  @Min(0)
  unqualifiedTeachers: number;
}

export class CreateEnrollmentDto {
  @ApiProperty({ description: 'School ID for this enrollment' })
  @IsMongoId()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: 'Proprietor ID' })
  @IsMongoId()
  @IsNotEmpty()
  proprietorId: string;

  @ApiProperty({ description: 'Academic year (e.g., 2024/2025)' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ 
    description: 'School term',
    enum: ['First', 'Second', 'Third']
  })
  @IsEnum(['First', 'Second', 'Third'])
  term: string;

  @ApiPropertyOptional({ description: 'Enrollment numbers by class level' })
  @ValidateNested()
  @Type(() => EnrollmentByLevelDto)
  @IsOptional()
  enrollmentByLevel?: EnrollmentByLevelDto;

  @ApiProperty({ description: 'Gender breakdown of students' })
  @ValidateNested()
  @Type(() => GenderBreakdownDto)
  genderBreakdown: GenderBreakdownDto;

  @ApiProperty({ description: 'Staff information' })
  @ValidateNested()
  @Type(() => StaffDataDto)
  staffData: StaffDataDto;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;
}

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {
  @ApiPropertyOptional({ 
    description: 'Enrollment status',
    enum: ['draft', 'submitted', 'verified', 'approved', 'rejected']
  })
  @IsEnum(['draft', 'submitted', 'verified', 'approved', 'rejected'])
  @IsOptional()
  status?: string;
}

export class SchoolQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search term for school name or address' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by proprietor ID' })
  @IsMongoId()
  @IsOptional()
  proprietorId?: string;

  @ApiPropertyOptional({ description: 'Filter by LGA' })
  @IsString()
  @IsOptional()
  lga?: string;

  @ApiPropertyOptional({ description: 'Filter by AEQEO Zone' })
  @IsString()
  @IsOptional()
  aeqeoZone?: string;

  @ApiPropertyOptional({ description: 'Filter by type of school' })
  @IsString()
  @IsOptional()
  typeOfSchool?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsString()
  @IsOptional()
  categoryOfSchool?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by primary school status' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ 
    description: 'Sort by field',
    enum: ['schoolName', 'yearOfEstablishment', 'createdAt', 'totalEnrollment']
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

export class EnrollmentQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by school ID' })
  @IsMongoId()
  @IsOptional()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Filter by proprietor ID' })
  @IsMongoId()
  @IsOptional()
  proprietorId?: string;

  @ApiPropertyOptional({ description: 'Filter by academic year' })
  @IsString()
  @IsOptional()
  academicYear?: string;

  @ApiPropertyOptional({ description: 'Filter by term' })
  @IsEnum(['First', 'Second', 'Third'])
  @IsOptional()
  term?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by status',
    enum: ['draft', 'submitted', 'verified', 'approved', 'rejected']
  })
  @IsEnum(['draft', 'submitted', 'verified', 'approved', 'rejected'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ 
    description: 'Sort by field',
    enum: ['academicYear', 'term', 'totalEnrollment', 'createdAt']
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