import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HomepageContentDocument = HomepageContent & Document;

@Schema({ timestamps: true })
export class HomepageContent {
  @Prop({ required: true, unique: true })
  contentKey: string; // e.g., 'hero_section', 'elder_omaku', 'leadership_team'

  @Prop({ required: true })
  contentType: string; // 'text', 'image', 'gallery', 'person', 'section'

  @Prop({ required: true })
  title: string;

  @Prop()
  subtitle?: string;

  @Prop({ type: Object })
  content: Record<string, any>; // Flexible content storage

  @Prop()
  description?: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  imagePublicId?: string; // Cloudinary public ID

  @Prop([String])
  galleryUrls?: string[]; // For image galleries

  @Prop([String])
  galleryPublicIds?: string[]; // Cloudinary public IDs for galleries

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number; // For ordering content sections

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional metadata
}

export const HomepageContentSchema = SchemaFactory.createForClass(HomepageContent);

// Create indexes
HomepageContentSchema.index({ contentKey: 1 });
HomepageContentSchema.index({ contentType: 1 });
HomepageContentSchema.index({ isActive: 1, sortOrder: 1 });

// Virtual for responsive image URLs
HomepageContentSchema.virtual('responsiveImages').get(function() {
  if (!this.imagePublicId) return null;
  
  // Generate different sizes for responsive images
  const baseUrl = 'https://res.cloudinary.com/your-cloud-name/image/upload/';
  return {
    thumbnail: `${baseUrl}w_200,h_200,c_fill/${this.imagePublicId}`,
    small: `${baseUrl}w_400,h_300,c_fill/${this.imagePublicId}`,
    medium: `${baseUrl}w_800,h_600,c_fill/${this.imagePublicId}`,
    large: `${baseUrl}w_1200,h_900,c_fill/${this.imagePublicId}`,
  };
});