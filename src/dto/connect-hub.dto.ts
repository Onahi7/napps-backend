import { IsString, IsBoolean, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums for DTOs
export enum AnnouncementType {
  INFO = 'info',
  WARNING = 'warning',
  SUCCESS = 'success',
  ERROR = 'error'
}

export enum SettingType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  JSON = 'json'
}

export enum ContentType {
  TEXT = 'text',
  HTML = 'html',
  IMAGE = 'image',
  VIDEO = 'video',
  JSON = 'json'
}

// Hero Images DTOs
export class CreateHeroImageDto {
  @ApiProperty({ description: 'Hero image title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Hero image description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Hero image URL' })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Display order', default: 1 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Button text' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ description: 'Button link' })
  @IsOptional()
  @IsString()
  buttonLink?: string;
}

export class UpdateHeroImageDto {
  @ApiPropertyOptional({ description: 'Hero image title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Hero image description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Hero image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Button text' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ description: 'Button link' })
  @IsOptional()
  @IsString()
  buttonLink?: string;
}

// Members DTOs
export class CreateMemberDto {
  @ApiProperty({ description: 'Member name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Member position' })
  @IsString()
  position: string;

  @ApiPropertyOptional({ description: 'Member biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Member image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 1 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Social media links' })
  @IsOptional()
  socialMedia?: Record<string, string>;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Member name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Member position' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Member biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Member image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Social media links' })
  @IsOptional()
  socialMedia?: Record<string, string>;
}

// Announcements DTOs
export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Announcement message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Announcement type', enum: AnnouncementType, default: AnnouncementType.INFO })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Show on all pages', default: false })
  @IsOptional()
  @IsBoolean()
  showOnAllPages?: boolean;

  @ApiPropertyOptional({ description: 'Background color', default: '#1e40af' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Text color', default: '#ffffff' })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 1 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: 'Announcement title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Announcement message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Announcement type', enum: AnnouncementType })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Show on all pages' })
  @IsOptional()
  @IsBoolean()
  showOnAllPages?: boolean;

  @ApiPropertyOptional({ description: 'Background color' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Text color' })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

// Site Settings DTOs
export class CreateSiteSettingDto {
  @ApiProperty({ description: 'Setting key' })
  @IsString()
  settingKey: string;

  @ApiPropertyOptional({ description: 'Setting value' })
  @IsOptional()
  @IsString()
  settingValue?: string;

  @ApiPropertyOptional({ description: 'Setting type', enum: SettingType, default: SettingType.TEXT })
  @IsOptional()
  @IsEnum(SettingType)
  settingType?: SettingType;

  @ApiPropertyOptional({ description: 'Setting description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Is public', default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateSiteSettingDto {
  @ApiPropertyOptional({ description: 'Setting value' })
  @IsOptional()
  @IsString()
  settingValue?: string;

  @ApiPropertyOptional({ description: 'Setting type', enum: SettingType })
  @IsOptional()
  @IsEnum(SettingType)
  settingType?: SettingType;

  @ApiPropertyOptional({ description: 'Setting description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Is public' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// Page Content DTOs
export class CreatePageContentDto {
  @ApiProperty({ description: 'Page name' })
  @IsString()
  pageName: string;

  @ApiProperty({ description: 'Section name' })
  @IsString()
  sectionName: string;

  @ApiPropertyOptional({ description: 'Content type', enum: ContentType, default: ContentType.TEXT })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({ description: 'Content data' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Display order', default: 1 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class UpdatePageContentDto {
  @ApiPropertyOptional({ description: 'Content type', enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({ description: 'Content data' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

// Query DTOs
export class QueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;
}