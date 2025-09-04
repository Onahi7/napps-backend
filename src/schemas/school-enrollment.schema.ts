import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SchoolEnrollmentDocument = SchoolEnrollment & Document;

@Schema({ timestamps: true })
export class SchoolEnrollment {
  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, default: '2024/2025' })
  academicYear: string;

  // Nursery Enrollment
  @Prop({ type: Number, default: 0 })
  nursery1Male: number;

  @Prop({ type: Number, default: 0 })
  nursery1Female: number;

  @Prop({ type: Number, default: 0 })
  nursery2Male: number;

  @Prop({ type: Number, default: 0 })
  nursery2Female: number;

  @Prop({ type: Number, default: 0 })
  nursery3Male: number;

  @Prop({ type: Number, default: 0 })
  nursery3Female: number;

  // Kindergarten Enrollment
  @Prop({ type: Number, default: 0 })
  kg1Male: number;

  @Prop({ type: Number, default: 0 })
  kg1Female: number;

  @Prop({ type: Number, default: 0 })
  kg2Male: number;

  @Prop({ type: Number, default: 0 })
  kg2Female: number;

  // Primary Enrollment
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

  // Secondary Enrollment (if applicable)
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

  @Prop({ type: Number, default: 0 })
  pupilsPresented2023: number;

  // Virtual for total enrollment
  get totalEnrollment(): number {
    return (
      this.nursery1Male + this.nursery1Female +
      this.nursery2Male + this.nursery2Female +
      this.nursery3Male + this.nursery3Female +
      this.kg1Male + this.kg1Female +
      this.kg2Male + this.kg2Female +
      this.primary1Male + this.primary1Female +
      this.primary2Male + this.primary2Female +
      this.primary3Male + this.primary3Female +
      this.primary4Male + this.primary4Female +
      this.primary5Male + this.primary5Female +
      this.primary6Male + this.primary6Female +
      this.jss1Male + this.jss1Female +
      this.jss2Male + this.jss2Female +
      this.jss3Male + this.jss3Female +
      this.ss1Male + this.ss1Female +
      this.ss2Male + this.ss2Female +
      this.ss3Male + this.ss3Female
    );
  }
}

export const SchoolEnrollmentSchema = SchemaFactory.createForClass(SchoolEnrollment);

// Add virtual for total enrollment
SchoolEnrollmentSchema.virtual('totalEnrollment').get(function() {
  return (
    (this.nursery1Male || 0) + (this.nursery1Female || 0) +
    (this.nursery2Male || 0) + (this.nursery2Female || 0) +
    (this.nursery3Male || 0) + (this.nursery3Female || 0) +
    (this.kg1Male || 0) + (this.kg1Female || 0) +
    (this.kg2Male || 0) + (this.kg2Female || 0) +
    (this.primary1Male || 0) + (this.primary1Female || 0) +
    (this.primary2Male || 0) + (this.primary2Female || 0) +
    (this.primary3Male || 0) + (this.primary3Female || 0) +
    (this.primary4Male || 0) + (this.primary4Female || 0) +
    (this.primary5Male || 0) + (this.primary5Female || 0) +
    (this.primary6Male || 0) + (this.primary6Female || 0) +
    (this.jss1Male || 0) + (this.jss1Female || 0) +
    (this.jss2Male || 0) + (this.jss2Female || 0) +
    (this.jss3Male || 0) + (this.jss3Female || 0) +
    (this.ss1Male || 0) + (this.ss1Female || 0) +
    (this.ss2Male || 0) + (this.ss2Female || 0) +
    (this.ss3Male || 0) + (this.ss3Female || 0)
  );
});

// Ensure virtuals are included in JSON output
SchoolEnrollmentSchema.set('toJSON', { virtuals: true });
SchoolEnrollmentSchema.set('toObject', { virtuals: true });

// Index for performance
SchoolEnrollmentSchema.index({ schoolId: 1, academicYear: 1 }, { unique: true });