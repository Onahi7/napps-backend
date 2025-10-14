import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SchoolDocument = School & Document;

// Enrollment breakdown by grade and gender
@Schema({ _id: false })
class EnrollmentData {
  // Kindergarten
  @Prop({ type: Number, default: 0 })
  kg1Male: number;

  @Prop({ type: Number, default: 0 })
  kg1Female: number;

  @Prop({ type: Number, default: 0 })
  kg2Male: number;

  @Prop({ type: Number, default: 0 })
  kg2Female: number;

  @Prop({ type: Number, default: 0 })
  eccdMale: number;

  @Prop({ type: Number, default: 0 })
  eccdFemale: number;

  // Nursery
  @Prop({ type: Number, default: 0 })
  nursery1Male: number;

  @Prop({ type: Number, default: 0 })
  nursery1Female: number;

  @Prop({ type: Number, default: 0 })
  nursery2Male: number;

  @Prop({ type: Number, default: 0 })
  nursery2Female: number;

  // Primary
  @Prop({ type: Number, default: 0 })
  primary1Male: number;

  @Prop({ type: Number, default: 0 })
  primary1Female: number;

  @Prop({ type: Number, default: 0 })
  primary2Male: number;

  @Prop({ type: Number, default: 0 })
  primary2Female: number;

  @Prop({ type: Number, default: 0 })
  primary3Male: number;

  @Prop({ type: Number, default: 0 })
  primary3Female: number;

  @Prop({ type: Number, default: 0 })
  primary4Male: number;

  @Prop({ type: Number, default: 0 })
  primary4Female: number;

  @Prop({ type: Number, default: 0 })
  primary5Male: number;

  @Prop({ type: Number, default: 0 })
  primary5Female: number;

  @Prop({ type: Number, default: 0 })
  primary6Male: number;

  @Prop({ type: Number, default: 0 })
  primary6Female: number;

  // Junior Secondary (JSS)
  @Prop({ type: Number, default: 0 })
  jss1Male: number;

  @Prop({ type: Number, default: 0 })
  jss1Female: number;

  @Prop({ type: Number, default: 0 })
  jss2Male: number;

  @Prop({ type: Number, default: 0 })
  jss2Female: number;

  @Prop({ type: Number, default: 0 })
  jss3Male: number;

  @Prop({ type: Number, default: 0 })
  jss3Female: number;

  // Senior Secondary (SS)
  @Prop({ type: Number, default: 0 })
  ss1Male: number;

  @Prop({ type: Number, default: 0 })
  ss1Female: number;

  @Prop({ type: Number, default: 0 })
  ss2Male: number;

  @Prop({ type: Number, default: 0 })
  ss2Female: number;

  @Prop({ type: Number, default: 0 })
  ss3Male: number;

  @Prop({ type: Number, default: 0 })
  ss3Female: number;
}

@Schema({ timestamps: true })
export class School {
  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: true })
  proprietorId: Types.ObjectId;

  // Basic School Information
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

  // GPS Coordinates
  @Prop({ type: Number, precision: 7 })
  gpsLongitude?: number;

  @Prop({ type: Number, precision: 7 })
  gpsLatitude?: number;

  // School Classification
  @Prop({ 
    enum: ['Faith Based', 'Conventional', 'Islamiyah Integrated', 'Secular', 'Other'],
  })
  typeOfSchool?: string;

  @Prop({ default: 'Private' })
  categoryOfSchool: string;

  @Prop({ 
    enum: ['Individual(s)', 'Sole', 'Partnership', 'Corporate', 'Community', 'Religious Organization', 'Other'],
  })
  ownership?: string;

  // Establishment Details
  @Prop()
  yearOfEstablishment?: number;

  @Prop()
  yearOfApproval?: number;

  @Prop()
  registrationEvidence?: string; // Document reference or description

  // Enrollment Data - 40+ fields for grade-level enrollment by gender
  @Prop({ type: EnrollmentData, default: {} })
  enrollment: EnrollmentData;

  // Computed Enrollment Totals
  @Prop({ type: Number, default: 0 })
  totalEnrollment: number;

  @Prop({ type: Number, default: 0 })
  totalMale: number;

  @Prop({ type: Number, default: 0 })
  totalFemale: number;

  @Prop({ default: true })
  isPrimary: boolean; // Primary school for this proprietor

  @Prop({ default: true })
  isActive: boolean;

  // Store images in Cloudinary
  @Prop([String])
  images?: string[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);

// Pre-save hook to calculate enrollment totals
SchoolSchema.pre('save', function (next) {
  if (this.enrollment) {
    const e = this.enrollment;
    
    this.totalMale = (
      (e.kg1Male || 0) + (e.kg2Male || 0) + (e.eccdMale || 0) +
      (e.nursery1Male || 0) + (e.nursery2Male || 0) +
      (e.primary1Male || 0) + (e.primary2Male || 0) + 
      (e.primary3Male || 0) + (e.primary4Male || 0) +
      (e.primary5Male || 0) + (e.primary6Male || 0) +
      (e.jss1Male || 0) + (e.jss2Male || 0) + (e.jss3Male || 0) +
      (e.ss1Male || 0) + (e.ss2Male || 0) + (e.ss3Male || 0)
    );

    this.totalFemale = (
      (e.kg1Female || 0) + (e.kg2Female || 0) + (e.eccdFemale || 0) +
      (e.nursery1Female || 0) + (e.nursery2Female || 0) +
      (e.primary1Female || 0) + (e.primary2Female || 0) + 
      (e.primary3Female || 0) + (e.primary4Female || 0) +
      (e.primary5Female || 0) + (e.primary6Female || 0) +
      (e.jss1Female || 0) + (e.jss2Female || 0) + (e.jss3Female || 0) +
      (e.ss1Female || 0) + (e.ss2Female || 0) + (e.ss3Female || 0)
    );

    this.totalEnrollment = this.totalMale + this.totalFemale;
  }
  next();
});

// Index for better query performance
SchoolSchema.index({ proprietorId: 1 });
SchoolSchema.index({ schoolName: 1 });
