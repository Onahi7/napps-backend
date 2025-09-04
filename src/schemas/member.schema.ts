import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MemberDocument = Member & Document;

@Schema({ timestamps: true })
export class Member {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  position: string;

  @Prop()
  bio?: string;

  @Prop()
  imageUrl?: string; // Cloudinary URL

  @Prop({ required: true, default: 1 })
  displayOrder: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ type: Object, default: {} })
  socialMedia?: Record<string, string>; // LinkedIn, Twitter, etc.
}

export const MemberSchema = SchemaFactory.createForClass(Member);

// Index for display order
MemberSchema.index({ displayOrder: 1 });
MemberSchema.index({ isActive: 1 });