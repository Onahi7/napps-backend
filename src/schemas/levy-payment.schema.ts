import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LevyPaymentDocument = LevyPayment & Document;

@Schema({ timestamps: true })
export class LevyPayment {
  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: false })
  proprietorId?: Types.ObjectId;

  @Prop({ required: true })
  memberName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  chapter: string;

  @Prop({ required: true })
  schoolName: string;

  @Prop({ default: false })
  isManualSchoolEntry: boolean;

  @Prop({ type: [String], default: [] })
  wards: string[];

  @Prop({ required: true, type: Number })
  amount: number; // Amount in kobo (5250 * 100 = 525000)

  @Prop({ 
    enum: ['pending', 'processing', 'success', 'failed', 'refunded'], 
    default: 'pending' 
  })
  status: string;

  @Prop({ required: true, unique: true })
  reference: string;

  @Prop()
  flutterwaveTransactionId?: string;

  @Prop()
  flutterwavePaymentId?: string;

  @Prop()
  paymentUrl?: string;

  @Prop({ 
    enum: ['card', 'bank_transfer', 'ussd', 'mobile_money', 'other'],
    default: 'card'
  })
  paymentMethod: string;

  @Prop()
  gatewayResponse?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  failureReason?: string;

  @Prop()
  receiptUrl?: string;

  @Prop()
  receiptNumber?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  // For duplicate email/phone tracking
  @Prop()
  previousPaymentReference?: string;

  @Prop({ default: false })
  isContinuation: boolean;

  // Timestamp for tracking
  createdAt?: Date;
  updatedAt?: Date;
}

export const LevyPaymentSchema = SchemaFactory.createForClass(LevyPayment);

// Indexes for better query performance
LevyPaymentSchema.index({ proprietorId: 1 });
LevyPaymentSchema.index({ reference: 1 });
LevyPaymentSchema.index({ email: 1 });
LevyPaymentSchema.index({ phone: 1 });
LevyPaymentSchema.index({ status: 1 });
LevyPaymentSchema.index({ chapter: 1 });
