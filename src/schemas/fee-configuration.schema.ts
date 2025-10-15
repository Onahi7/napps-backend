import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeeConfigurationDocument = FeeConfiguration & Document;

@Schema({ timestamps: true, collection: 'fees' })
export class FeeConfiguration {
  @Prop({ required: true, unique: true })
  name: string; // e.g., "Membership Fee", "Registration Fee"

  @Prop({ required: true })
  code: string; // e.g., "membership_fee", "registration_fee"

  @Prop({ required: true })
  amount: number; // Amount in Naira (will be converted to kobo for Paystack)

  @Prop()
  description?: string;

  @Prop({
    type: {
      platformFeePercentage: { type: Number, default: 0, min: 0, max: 100 },
      platformFeeFixed: { type: Number, default: 0, min: 0 },
      processingFeePercentage: { type: Number, default: 1.5, min: 0, max: 100 }, // Paystack default
      processingFeeCap: { type: Number, default: 200000 }, // ₦2000 cap in kobo
      nappsSharePercentage: { type: Number, default: 0, min: 0, max: 100 },
      nappsShareFixed: { type: Number, default: 0, min: 0 },
    },
    default: {}
  })
  feeStructure: {
    platformFeePercentage: number; // Percentage fee
    platformFeeFixed: number; // Fixed fee in kobo
    processingFeePercentage: number; // Payment gateway percentage
    processingFeeCap: number; // Maximum processing fee
    nappsSharePercentage: number; // NAPPS association share percentage
    nappsShareFixed: number; // NAPPS fixed share in kobo
  };

  @Prop()
  paystackSplitCode?: string; // Paystack split code (e.g., SPL_xxxxxxxxxx)

  @Prop()
  splitCodeDescription?: string; // Description of what this split code does

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isRecurring: boolean; // For annual dues, etc.

  @Prop()
  recurringInterval?: string; // 'monthly', 'quarterly', 'annually'

  @Prop()
  dueDate?: Date; // When this fee becomes due

  @Prop({ 
    enum: ['required', 'optional'], 
    default: 'required' 
  })
  status: string;

  @Prop({ default: 0 })
  minimumAmount: number; // Minimum payment amount allowed

  @Prop()
  maximumAmount?: number; // Maximum payment amount allowed

  @Prop({ default: false })
  allowPartialPayment: boolean;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  validFrom?: Date;

  @Prop()
  validUntil?: Date;

  @Prop()
  lastModifiedBy?: string; // Admin user ID who last modified
}

export const FeeConfigurationSchema = SchemaFactory.createForClass(FeeConfiguration);

// Indexes
FeeConfigurationSchema.index({ code: 1 });
FeeConfigurationSchema.index({ isActive: 1 });
FeeConfigurationSchema.index({ validFrom: 1, validUntil: 1 });

// Virtual for total amount with fees
FeeConfigurationSchema.virtual('totalAmount').get(function() {
  const base = this.amount * 100; // Convert to kobo
  const fees = this.feeStructure || {
    platformFeeFixed: 0,
    platformFeePercentage: 0,
    processingFeePercentage: 1.5,
    processingFeeCap: 200000,
    nappsShareFixed: 0,
    nappsSharePercentage: 0
  };
  
  const platformFee = (fees.platformFeeFixed || 0) + (base * (fees.platformFeePercentage || 0) / 100);
  const processingFee = Math.min(
    (base * (fees.processingFeePercentage || 1.5) / 100),
    fees.processingFeeCap || 200000
  );
  const nappsFee = (fees.nappsShareFixed || 0) + (base * (fees.nappsSharePercentage || 0) / 100);
  
  return Math.round(base + platformFee + processingFee + nappsFee);
});

FeeConfigurationSchema.set('toJSON', { virtuals: true });
FeeConfigurationSchema.set('toObject', { virtuals: true });
