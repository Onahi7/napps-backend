import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SchoolDocument = School & Document;

@Schema({ timestamps: true })
export class School {
  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: true })
  proprietorId: Types.ObjectId;

  @Prop({ required: true })
  schoolName: string;

  @Prop()
  schoolName2?: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  addressLine2?: string;

  @Prop()
  lga?: string;

  @Prop()
  aeqeoZone?: string;

  @Prop()
  yearOfEstablishment?: number;

  @Prop()
  yearOfApproval?: number;

  @Prop()
  typeOfSchool?: string; // Faith Based, Secular, etc.

  @Prop({ default: 'Private' })
  categoryOfSchool: string;

  @Prop()
  ownership?: string; // Individual(s), Corporate, etc.

  @Prop({ type: Number, precision: 7 })
  gpsLongitude?: number;

  @Prop({ type: Number, precision: 7 })
  gpsLatitude?: number;

  @Prop({ default: true })
  isPrimary: boolean; // Primary school for this proprietor

  @Prop({ default: true })
  isActive: boolean;

  // Store images in Cloudinary
  @Prop([String])
  images?: string[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);

// Index for better query performance
SchoolSchema.index({ proprietorId: 1 });
SchoolSchema.index({ schoolName: 1 });