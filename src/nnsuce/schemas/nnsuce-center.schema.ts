import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NnsuceCenterDocument = NnsuceCenter & Document;

@Schema({ timestamps: true })
export class NnsuceCenter {
  @Prop({ required: true, unique: true })
  centerCode: string; // e.g. 'NAS-C01'

  @Prop({ required: true })
  name: string; // e.g. 'Lafia Central Examination Center'

  @Prop({ required: true })
  lga: string; // e.g. 'Lafia'

  @Prop({ required: true })
  address: string;

  @Prop({ required: true, default: 250 })
  capacity: number;

  @Prop({ required: true })
  supervisorName: string;

  @Prop({ required: false, default: '' })
  supervisorPhone: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const NnsuceCenterSchema = SchemaFactory.createForClass(NnsuceCenter);
NnsuceCenterSchema.index({ centerCode: 1 });
NnsuceCenterSchema.index({ lga: 1 });
