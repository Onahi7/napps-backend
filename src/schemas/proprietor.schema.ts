import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NASARAWA_LGAS } from '../common/constants/nasarawa-lgas';
import type { NasarawaLga } from '../common/constants/nasarawa-lgas';
import { NAPPS_CHAPTERS } from '../common/constants/napps-chapters';
import type { NappsChapter } from '../common/constants/napps-chapters';

export type ProprietorDocument = Proprietor & Document;

@Schema({ timestamps: true })
export class Proprietor {
  // STEP 1: Personal Information
  @Prop({ required: true })
  firstName: string;

  @Prop()
  middleName?: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ enum: ['Male', 'Female'], required: true })
  sex: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ enum: NASARAWA_LGAS, required: true })
  lga: NasarawaLga;

  @Prop({ type: [String], enum: NAPPS_CHAPTERS, default: [] })
  chapters: NappsChapter[];

  @Prop({ unique: true, sparse: true })
  registrationNumber?: string;

  @Prop({ unique: true, sparse: true })
  nappsMembershipId?: string;

  // NAPPS Participation Details
  @Prop({ 
    enum: ['Not Registered', 'Registered', 'Registered with Certificate'],
    default: 'Not Registered' 
  })
  nappsRegistered: string;

  @Prop({ type: [String], default: [] })
  participationHistory: string[]; // e.g., ["National: 2023/2024, 2024/2025", "State: 2023/2024"]

  @Prop({ type: Number, default: 0 })
  timesParticipated: number;

  @Prop({ type: Number, default: 0 })
  pupilsPresentedLastExam: number;

  @Prop()
  awards?: string; // Awards received from NAPPS

  @Prop()
  positionHeld?: string; // Position at NAPPS level

  // Registration & Approval Status
  @Prop({ 
    enum: ['pending', 'approved', 'suspended', 'rejected'], 
    default: 'pending' 
  })
  registrationStatus: string;

  @Prop({ 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  })
  approvalStatus: string;

  @Prop()
  approvalEvidence?: string; // URL or description of approval evidence

  // Payment & Clearing Status
  @Prop({ 
    enum: ['pending', 'cleared', 'outstanding'], 
    default: 'pending' 
  })
  clearingStatus: string;

  @Prop({ type: Number, default: 0 })
  totalAmountDue: number;

  @Prop()
  paymentMethod?: string; // Digital Capturing, Online, etc.

  @Prop()
  lastPaymentDate?: Date;

  @Prop()
  paymentStatus?: string; // Pending, Paid, etc.

  // Submission Tracking
  @Prop({ unique: true, sparse: true })
  submissionId?: string;

  @Prop()
  submissionSerialNumber?: string;

  @Prop({ default: Date.now })
  submissionDate: Date;

  @Prop({ 
    enum: ['draft', 'step1', 'step2', 'step3', 'submitted', 'processed', 'archived'],
    default: 'draft' 
  })
  submissionStatus: string;

  // School Reference
  @Prop({ type: Types.ObjectId, ref: 'School' })
  school?: Types.ObjectId;

  @Prop()
  sourceUrl?: string;

  @Prop()
  submitterBrowser?: string;

  @Prop()
  submitterDevice?: string;

  @Prop()
  submitterIp?: string;

  @Prop({ default: true })
  isActive: boolean;

  // Virtual for full name
  get fullName(): string {
    const middle = this.middleName ? ` ${this.middleName}` : '';
    return `${this.firstName}${middle} ${this.lastName}`;
  }
}

export const ProprietorSchema = SchemaFactory.createForClass(Proprietor);

// Add virtual for fullName
ProprietorSchema.virtual('fullName').get(function() {
  const middle = this.middleName ? ` ${this.middleName}` : '';
  return `${this.firstName}${middle} ${this.lastName}`;
});

// Ensure virtuals are included in JSON output
ProprietorSchema.set('toJSON', { virtuals: true });
ProprietorSchema.set('toObject', { virtuals: true });