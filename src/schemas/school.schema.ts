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
  chapter?: string; // NAPPS chapter the school belongs to

  @Prop()
  aegeLgeaDa?: string; // AEGE / LGEA / DA area

  @Prop({ 
    enum: ['REGISTERED', 'NOT REGISTERED', 'IN PROGRESS', 'Registered', 'Not Registered', 'In Progress'],
    default: 'IN PROGRESS'
  })
  schoolRegistrationStatus?: string;

  @Prop()
  levelsOfEducation?: string; // Nursery/Primary, Primary, JSS Only, JSS & SSS

  @Prop()
  schoolCode?: string;

  @Prop()
  phone?: string;

  @Prop()
  aeqeoZone?: string;

  @Prop()
  yearOfEstablishment?: number;

  @Prop()
  yearOfApproval?: number;

  @Prop()
  typeOfSchool?: string; // Regular, Islamiyya Integrated, Special Needs

  @Prop({ default: 'Private' })
  categoryOfSchool: string;

  @Prop()
  ownership?: string; // Individual(s), Corporate, etc.

  @Prop({ type: Number, precision: 7 })
  gpsLongitude?: number;

  @Prop({ type: Number, precision: 7 })
  gpsLatitude?: number;

  @Prop()
  registrationEvidence?: string;

  @Prop()
  registrationEvidencePhoto?: string;

  @Prop({ type: Object })
  enrollment?: Record<string, number>;

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
SchoolSchema.index({ chapter: 1 });