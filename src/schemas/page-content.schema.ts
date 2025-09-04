import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PageContentDocument = PageContent & Document;

export enum ContentType {
  TEXT = 'text',
  HTML = 'html',
  IMAGE = 'image',
  VIDEO = 'video',
  JSON = 'json'
}

@Schema({ timestamps: true })
export class PageContent {
  @ApiProperty({ description: 'Page name' })
  @Prop({ required: true })
  pageName: string;

  @ApiProperty({ description: 'Section name' })
  @Prop({ required: true })
  sectionName: string;

  @ApiProperty({ description: 'Content type', enum: ContentType, default: ContentType.TEXT })
  @Prop({ enum: ContentType, default: ContentType.TEXT })
  contentType: ContentType;

  @ApiProperty({ description: 'Content data' })
  @Prop()
  content?: string;

  @ApiProperty({ description: 'Whether content is active', default: true })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Display order for sorting', default: 1 })
  @Prop({ default: 1 })
  displayOrder: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt?: Date;
}

export const PageContentSchema = SchemaFactory.createForClass(PageContent);

// Indexes
PageContentSchema.index({ pageName: 1, sectionName: 1 }, { unique: true });
PageContentSchema.index({ isActive: 1 });
PageContentSchema.index({ displayOrder: 1 });