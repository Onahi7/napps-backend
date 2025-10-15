import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface PaymentMethods {
  comparePaymentReference(reference: string): Promise<boolean>;
}

export interface PaymentVirtuals {
  totalAmount: number;
  amountInNaira: number;
}

export interface PaymentTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = Payment & Document & PaymentMethods & PaymentVirtuals & PaymentTimestamps;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: true })
  proprietorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'School' })
  schoolId?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  reference: string; // Paystack transaction reference

  @Prop({ required: true })
  email: string; // Payer's email

  @Prop()
  callbackUrl?: string; // Paystack callback URL

  @Prop({ required: true })
  amount: number; // Amount in kobo (Paystack format)

  @Prop({ required: true, default: 'NGN' })
  currency: string;

  @Prop({
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
    default: 'pending'
  })
  status: string;

  @Prop({
    enum: [
      'membership_fee',
      'registration_fee', 
      'conference_fee',
      'workshop_fee',
      'certification_fee',
      'annual_dues',
      'napps_dues',
      'digital_capturing',
      'other'
    ],
    required: true
  })
  paymentType: string;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional payment metadata

  // Paystack specific fields
  @Prop()
  paystackTransactionId?: string;

  @Prop()
  paystackAuthorizationCode?: string;

  @Prop()
  paystackCardType?: string;

  @Prop()
  paystackBank?: string;

  @Prop()
  paystackChannel?: string; // card, bank, mobile_money, etc.

  @Prop()
  gatewayResponse?: string;

  // Split payment with Paystack split code
  @Prop()
  paystackSplitCode?: string; // Split code (e.g., SPL_xxxxxxxxxx) configured in fee configuration

  // Fee breakdown
  @Prop({
    type: {
      platformFee: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      nappsShare: { type: Number, default: 0 },
      proprietorShare: { type: Number, default: 0 },
    },
    default: {}
  })
  feeBreakdown: {
    platformFee: number;
    processingFee: number;
    nappsShare: number;
    proprietorShare: number;
  };

  @Prop()
  paidAt?: Date;

  @Prop()
  dueDate?: Date;

  @Prop()
  failureReason?: string;

  @Prop()
  webhookReceived?: boolean; // Track if webhook was received

  @Prop({ type: Object })
  webhookData?: Record<string, any>; // Store webhook payload

  @Prop()
  refundedAmount?: number; // Amount refunded if any

  @Prop()
  refundReason?: string;

  @Prop()
  refundedAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  // Virtual for amount in Naira
  get amountInNaira(): number {
    return this.amount / 100;
  }
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Add virtual for amountInNaira
PaymentSchema.virtual('amountInNaira').get(function() {
  return this.amount / 100;
});

// Add virtual for totalAmount (includes fees)
PaymentSchema.virtual('totalAmount').get(function() {
  const fees = this.feeBreakdown || {
    platformFee: 0,
    processingFee: 0,
    nappsShare: 0,
    proprietorShare: 0
  };
  return this.amount + (fees.platformFee || 0) + (fees.processingFee || 0);
});

// Indexes for better performance
PaymentSchema.index({ proprietorId: 1 });
PaymentSchema.index({ schoolId: 1 });
PaymentSchema.index({ reference: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentType: 1 });
PaymentSchema.index({ paidAt: 1 });
PaymentSchema.index({ createdAt: 1 });

// Ensure virtuals are included in JSON output
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });