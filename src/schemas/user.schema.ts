import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface UserVirtuals {
  fullName: string;
}

export interface UserTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = User & Document & UserMethods & UserVirtuals & UserTimestamps;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop()
  middleName?: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ enum: ['Male', 'Female'] })
  sex?: string;

  @Prop()
  phone?: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop()
  avatar?: string;

  @Prop({
    type: String,
    enum: ['admin', 'proprietor', 'super_admin'],
    default: 'proprietor',
  })
  role: string;

  @Prop({
    type: [{ type: String, enum: ['connect_hub', 'portal'] }],
    default: ['portal'],
  })
  appAccess: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Proprietor' })
  proprietorProfile?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

UserSchema.virtual('fullName').get(function (this: UserDocument) {
  const middle = this.middleName ? ` ${this.middleName}` : '';
  return `${this.firstName}${middle} ${this.lastName}`;
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove sensitive fields using destructuring
    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      passwordResetExpires: _passwordResetExpires,
      emailVerificationToken: _emailVerificationToken,
      emailVerificationExpires: _emailVerificationExpires,
      ...result
    } = ret;
    return result;
  },
});

UserSchema.methods.comparePassword = async function (
  this: UserDocument,
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });