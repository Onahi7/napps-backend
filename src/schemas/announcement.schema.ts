import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnnouncementDocument = Announcement & Document;

@Schema({ timestamps: true })
export class Announcement {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ 
    enum: ['info', 'warning', 'success', 'error'], 
    default: 'info' 
  })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  showOnAllPages: boolean;

  @Prop({ default: false })
  showOnPortal: boolean; // Show on portal app

  @Prop({ default: '#1e40af' })
  backgroundColor: string;

  @Prop({ default: '#ffffff' })
  textColor: string;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ required: true, default: 1 })
  displayOrder: number;

  @Prop({ 
    enum: ['connect_hub', 'portal', 'both'], 
    default: 'both' 
  })
  appScope: string; // Which app to show in
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

// Indexes
AnnouncementSchema.index({ isActive: 1 });
AnnouncementSchema.index({ displayOrder: 1 });
AnnouncementSchema.index({ startDate: 1, endDate: 1 });