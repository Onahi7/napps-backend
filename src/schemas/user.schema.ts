import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  name?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ select: false })
  password?: string;

  @Prop()
  image?: string;

  @Prop({ 
    type: [{ type: String, enum: ['admin', 'super_admin', 'proprietor', 'user'] }], 
    default: ['user'] 
  })
  roles: string[];

  @Prop({ 
    type: String, 
    enum: ['admin', 'super_admin', 'proprietor', 'user'],
    default: 'user'
  })
  role?: string;

  @Prop({ 
    type: [{ type: String, enum: ['connect_hub', 'portal'] }], 
    default: ['connect_hub', 'portal'] 
  })
  appAccess: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified?: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  // NextAuth fields
  @Prop({ unique: true, sparse: true })
  id?: string;

  // Virtual for full name
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.name || this.email;
  }

  // Method to compare passwords
  comparePassword?: (candidatePassword: string) => Promise<boolean>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual for fullName
UserSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.name || this.email;
});

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure virtuals are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });