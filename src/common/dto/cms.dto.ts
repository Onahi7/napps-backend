import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsEnum,
  IsUrl,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// =============== HOMEPAGE CONTENT DTOs ===============

export class CreateHomepageContentDto {
  @ApiProperty({ description: 'Unique content key identifier' })
  @IsString()
  contentKey: string;

  @ApiProperty({
    description: 'Type of content',
    enum: ['text', 'image', 'gallery', 'person', 'section'],
  })
  @IsEnum(['text', 'image', 'gallery', 'person', 'section'])
  contentType: string;

  @ApiProperty({ description: 'Content title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Content subtitle' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({
    description: 'Flexible content storage',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  content: Record<string, any>;

  @ApiPropertyOptional({ description: 'Content description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary public ID' })
  @IsOptional()
  @IsString()
  imagePublicId?: string;

  @ApiPropertyOptional({ description: 'Gallery image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryUrls?: string[];

  @ApiPropertyOptional({
    description: 'Gallery image public IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryPublicIds?: string[];

  @ApiPropertyOptional({ description: 'Is content active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateHomepageContentDto extends PartialType(
  CreateHomepageContentDto,
) {}

export class HomepageContentQueryDto {
  @ApiPropertyOptional({ description: 'Filter by content type' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

// =============== TEAM MEMBER DTOs ===============

export class CreateTeamMemberDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Position/Job title' })
  @IsString()
  position: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'Twitter profile URL' })
  @IsOptional()
  @IsUrl()
  twitterUrl?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @ApiPropertyOptional({ description: 'Profile image public ID' })
  @IsOptional()
  @IsString()
  profileImagePublicId?: string;

  @ApiProperty({
    description: 'Member category',
    enum: ['executive', 'board', 'leadership', 'staff', 'advisory'],
    default: 'staff',
  })
  @IsEnum(['executive', 'board', 'leadership', 'staff', 'advisory'])
  category: string;

  @ApiProperty({
    description: 'Member role',
    enum: [
      'elder',
      'president',
      'vice_president',
      'secretary',
      'treasurer',
      'director',
      'manager',
      'coordinator',
      'member',
    ],
    default: 'member',
  })
  @IsEnum([
    'elder',
    'president',
    'vice_president',
    'secretary',
    'treasurer',
    'director',
    'manager',
    'coordinator',
    'member',
  ])
  role: string;

  @ApiPropertyOptional({ description: 'Is member active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Date joined' })
  @IsOptional()
  joinedDate?: Date;

  @ApiPropertyOptional({ description: 'Achievements', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  @ApiPropertyOptional({ description: 'Qualifications', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @ApiPropertyOptional({ description: 'Years of experience' })
  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @ApiPropertyOptional({ description: 'Specialization' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({
    description: 'Is featured on homepage',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateTeamMemberDto extends PartialType(CreateTeamMemberDto) {}

export class TeamMemberQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsEnum(['executive', 'board', 'leadership', 'staff', 'advisory'])
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by role' })
  @IsOptional()
  @IsEnum([
    'elder',
    'president',
    'vice_president',
    'secretary',
    'treasurer',
    'director',
    'manager',
    'coordinator',
    'member',
  ])
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by featured status' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

// =============== FILE UPLOAD DTOs ===============

export class FileUploadDto {
  @ApiProperty({ description: 'Upload folder', default: 'napps' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Custom public ID' })
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiPropertyOptional({ description: 'Image width' })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ description: 'Image height' })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ description: 'Crop mode', default: 'limit' })
  @IsOptional()
  @IsString()
  crop?: string;

  @ApiPropertyOptional({ description: 'Image quality', default: 'auto' })
  @IsOptional()
  quality?: string | number;
}

export class FileUploadResponseDto {
  @ApiProperty({ description: 'File URL' })
  url: string;

  @ApiProperty({ description: 'Cloudinary public ID' })
  publicId: string;

  @ApiProperty({ description: 'File format' })
  format: string;

  @ApiProperty({ description: 'Resource type' })
  resourceType: string;

  @ApiProperty({ description: 'File size in bytes' })
  bytes: number;

  @ApiPropertyOptional({ description: 'Image width' })
  width?: number;

  @ApiPropertyOptional({ description: 'Image height' })
  height?: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
}

// =============== EMAIL DTOs ===============

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email(s)' })
  @IsString()
  to: string | string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiPropertyOptional({ description: 'HTML content' })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({ description: 'Plain text content' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Sender email' })
  @IsOptional()
  @IsEmail()
  from?: string;

  @ApiPropertyOptional({ description: 'Reply-to email' })
  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

export class NewsletterDto {
  @ApiProperty({ description: 'Newsletter title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Newsletter content (HTML)' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Recipient emails', type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiPropertyOptional({ description: 'Featured image URL' })
  @IsOptional()
  @IsUrl()
  featuredImage?: string;
}

export class EventNotificationDto {
  @ApiProperty({ description: 'Event name' })
  @IsString()
  eventName: string;

  @ApiProperty({ description: 'Event date' })
  eventDate: Date;

  @ApiProperty({ description: 'Event location' })
  @IsString()
  eventLocation: string;

  @ApiProperty({ description: 'Event description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Recipient emails', type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiPropertyOptional({ description: 'Registration link' })
  @IsOptional()
  @IsUrl()
  registrationLink?: string;
}
