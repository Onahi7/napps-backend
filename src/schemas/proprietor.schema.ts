import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProprietorDocument = Proprietor & Document;

@Schema({ timestamps: true })
export class Proprietor {
  @Prop({ required: true })
  firstName: string;

  @Prop()
  middleName?: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ enum: ['Male', 'Female'] })
  sex?: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ unique: true, sparse: true })
  registrationNumber?: string;

  @Prop({ unique: true, sparse: true })
  nappsMembershipId?: string;

  @Prop({ 
    enum: ['pending', 'approved', 'suspended', 'rejected'], 
    default: 'pending' 
  })
  registrationStatus: string;

  @Prop({ 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  })
  approvalStatus?: string;

  @Prop({ 
    enum: ['Not Registered', 'Registered', 'Registered with Certificate'],
    default: 'Not Registered' 
  })
  nappsRegistered: string;

  @Prop({ type: Object, default: {} })
  participationHistory: Record<string, any>;

  @Prop()
  awards?: string;

  @Prop()
  positionHeld?: string;

  @Prop({ 
    enum: ['pending', 'cleared', 'outstanding'], 
    default: 'pending' 
  })
  clearingStatus: string;

  @Prop({ type: Number, default: 0 })
  totalAmountDue: number;

  @Prop()
  lastPaymentDate?: Date;

  @Prop({ unique: true, sparse: true })
  submissionId?: string;

  @Prop({ default: Date.now })
  submissionDate: Date;

  @Prop({ 
    enum: ['draft', 'submitted', 'processed', 'archived'],
    default: 'submitted' 
  })
  submissionStatus: string;

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