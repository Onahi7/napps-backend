import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  schoolId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: true })
  proprietorId: Types.ObjectId;

  @Prop({ required: true })
  academicYear: string; // e.g., "2024/2025"

  @Prop({ required: true })
  term: string; // First, Second, Third

  // Enrollment data by class/level
  @Prop({
    type: {
      // Pre-Primary levels
      nursery1: { type: Number, default: 0 },
      nursery2: { type: Number, default: 0 },
      kindergarten: { type: Number, default: 0 },
      
      // Primary levels
      primary1: { type: Number, default: 0 },
      primary2: { type: Number, default: 0 },
      primary3: { type: Number, default: 0 },
      primary4: { type: Number, default: 0 },
      primary5: { type: Number, default: 0 },
      primary6: { type: Number, default: 0 },
      
      // Junior Secondary
      jss1: { type: Number, default: 0 },
      jss2: { type: Number, default: 0 },
      jss3: { type: Number, default: 0 },
      
      // Senior Secondary
      ss1: { type: Number, default: 0 },
      ss2: { type: Number, default: 0 },
      ss3: { type: Number, default: 0 },
      
      // Special classes
      special: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },
    default: {}
  })
  enrollmentByLevel: {
    nursery1?: number;
    nursery2?: number;
    kindergarten?: number;
    primary1?: number;
    primary2?: number;
    primary3?: number;
    primary4?: number;
    primary5?: number;
    primary6?: number;
    jss1?: number;
    jss2?: number;
    jss3?: number;
    ss1?: number;
    ss2?: number;
    ss3?: number;
    special?: number;
    others?: number;
  };

  // Gender breakdown
  @Prop({
    type: {
      male: { type: Number, default: 0 },
      female: { type: Number, default: 0 },
    },
    default: {}
  })
  genderBreakdown: {
    male: number;
    female: number;
  };

  // Staff information
  @Prop({
    type: {
      teachingStaff: { type: Number, default: 0 },
      nonTeachingStaff: { type: Number, default: 0 },
      qualifiedTeachers: { type: Number, default: 0 },
      unqualifiedTeachers: { type: Number, default: 0 },
    },
    default: {}
  })
  staffData: {
    teachingStaff: number;
    nonTeachingStaff: number;
    qualifiedTeachers: number;
    unqualifiedTeachers: number;
  };

  @Prop({ default: 0 })
  totalEnrollment: number;

  @Prop({
    enum: ['draft', 'submitted', 'verified', 'approved', 'rejected'],
    default: 'draft'
  })
  status: string;

  @Prop()
  submittedAt?: Date;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  verifiedBy?: string;

  @Prop()
  remarks?: string;

  @Prop({ default: true })
  isActive: boolean;

  // Computed field for total enrollment
  get totalStudents(): number {
    const levels = this.enrollmentByLevel || {};
    return Object.values(levels).reduce((sum: number, count: number) => sum + (count || 0), 0);
  }
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Add virtual for totalStudents
EnrollmentSchema.virtual('totalStudents').get(function() {
  const levels = this.enrollmentByLevel || {};
  return Object.values(levels).reduce((sum: number, count: number) => sum + (count || 0), 0);
});

// Update totalEnrollment before saving
EnrollmentSchema.pre('save', function(next) {
  const levels = this.enrollmentByLevel || {};
  this.totalEnrollment = Object.values(levels).reduce((sum: number, count: number) => sum + (count || 0), 0);
  next();
});

// Indexes for better performance
EnrollmentSchema.index({ schoolId: 1, academicYear: 1, term: 1 });
EnrollmentSchema.index({ proprietorId: 1 });
EnrollmentSchema.index({ status: 1 });
EnrollmentSchema.index({ academicYear: 1 });

// Ensure virtuals are included in JSON output
EnrollmentSchema.set('toJSON', { virtuals: true });
EnrollmentSchema.set('toObject', { virtuals: true });