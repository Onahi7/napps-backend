import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TeamMemberDocument = TeamMember & Document;

@Schema({ timestamps: true })
export class TeamMember {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  position: string;

  @Prop()
  department?: string;

  @Prop()
  bio?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  linkedinUrl?: string;

  @Prop()
  twitterUrl?: string;

  @Prop()
  profileImageUrl?: string;

  @Prop()
  profileImagePublicId?: string; // Cloudinary public ID

  @Prop({
    enum: ['executive', 'board', 'leadership', 'staff', 'advisory'],
    default: 'staff'
  })
  category: string;

  @Prop({
    enum: ['elder', 'president', 'vice_president', 'secretary', 'treasurer', 'director', 'manager', 'coordinator', 'member'],
    default: 'member'
  })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number; // For ordering team members

  @Prop()
  joinedDate?: Date;

  @Prop([String])
  achievements?: string[];

  @Prop([String])
  qualifications?: string[];

  @Prop()
  yearsOfExperience?: number;

  @Prop()
  specialization?: string;

  @Prop({ default: false })
  isFeatured: boolean; // For featuring on homepage

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional metadata
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

// Create indexes
TeamMemberSchema.index({ category: 1 });
TeamMemberSchema.index({ role: 1 });
TeamMemberSchema.index({ isActive: 1, sortOrder: 1 });
TeamMemberSchema.index({ isFeatured: 1 });

// Virtual for full name
TeamMemberSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for responsive profile images
TeamMemberSchema.virtual('responsiveImages').get(function() {
  if (!this.profileImagePublicId) return null;
  
  const baseUrl = 'https://res.cloudinary.com/your-cloud-name/image/upload/';
  return {
    thumbnail: `${baseUrl}w_150,h_150,c_fill,g_face/${this.profileImagePublicId}`,
    small: `${baseUrl}w_300,h_300,c_fill,g_face/${this.profileImagePublicId}`,
    medium: `${baseUrl}w_400,h_400,c_fill,g_face/${this.profileImagePublicId}`,
    large: `${baseUrl}w_600,h_600,c_fill,g_face/${this.profileImagePublicId}`,
  };
});

// Ensure virtual fields are serialized
TeamMemberSchema.set('toJSON', { virtuals: true });
TeamMemberSchema.set('toObject', { virtuals: true });