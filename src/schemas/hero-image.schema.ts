import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HeroImageDocument = HeroImage & Document;

@Schema({ timestamps: true })
export class HeroImage {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  imageUrl: string; // Cloudinary URL

  @Prop({ required: true, default: 1 })
  displayOrder: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  buttonText?: string;

  @Prop()
  buttonLink?: string;
}

export const HeroImageSchema = SchemaFactory.createForClass(HeroImage);

// Indexes
HeroImageSchema.index({ displayOrder: 1 });
HeroImageSchema.index({ isActive: 1 });