import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Proprietor', required: true })
  proprietorId: Types.ObjectId;

  @Prop({ required: true })
  paymentType: string; // 'NAPPS_DUES', 'DIGITAL_CAPTURING', 'REGISTRATION', etc.

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, default: 'NGN' })
  currency: string;

  @Prop({ 
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'], 
    default: 'pending' 
  })
  status: string;

  @Prop({ 
    enum: ['paystack', 'bank_transfer', 'cash', 'online'],
    default: 'paystack' 
  })
  paymentMethod: string;

  @Prop({ unique: true, sparse: true })
  paystackReference?: string;

  @Prop()
  transactionId?: string;

  @Prop()
  bankReference?: string;

  @Prop()
  paymentDate?: Date;

  @Prop()
  dueDate?: Date;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // Paystack split code configuration
  @Prop()
  splitCode?: string;

  @Prop({ type: Object })
  splitConfig?: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Indexes for better performance
PaymentSchema.index({ proprietorId: 1 });
PaymentSchema.index({ paystackReference: 1 }, { sparse: true });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentDate: -1 });