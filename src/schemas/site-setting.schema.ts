import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SiteSettingDocument = SiteSetting & Document;

export enum SettingType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  JSON = 'json'
}

@Schema({ timestamps: true })
export class SiteSetting {
  @ApiProperty({ description: 'Unique setting key' })
  @Prop({ required: true, unique: true })
  settingKey: string;

  @ApiProperty({ description: 'Setting value' })
  @Prop()
  settingValue?: string;

  @ApiProperty({ description: 'Setting type', enum: SettingType, default: SettingType.TEXT })
  @Prop({ enum: SettingType, default: SettingType.TEXT })
  settingType: SettingType;

  @ApiProperty({ description: 'Setting description' })
  @Prop()
  description?: string;

  @ApiProperty({ description: 'Whether setting is public', default: true })
  @Prop({ default: true })
  isPublic: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt?: Date;
}

export const SiteSettingSchema = SchemaFactory.createForClass(SiteSetting);

// Indexes
SiteSettingSchema.index({ settingKey: 1 }, { unique: true });
SiteSettingSchema.index({ isPublic: 1 });