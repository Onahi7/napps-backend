import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;

  @Prop({ 
    type: [{ type: String, enum: ['admin', 'proprietor', 'user'] }], 
    default: ['user'] 
  })
  roles: string[];

  @Prop({ 
    type: [{ type: String, enum: ['connect_hub', 'portal'] }], 
    default: ['connect_hub', 'portal'] 
  })
  appAccess: string[]; // Which apps user can access

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;

  // NextAuth fields
  @Prop({ unique: true, sparse: true })
  id?: string; // NextAuth user ID
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ isActive: 1 });