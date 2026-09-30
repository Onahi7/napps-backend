import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NnsuceCandidateDocument = NnsuceCandidate & Document;

@Schema({ timestamps: true })
export class NnsuceCandidate {
  @Prop({ required: true, unique: true })
  examNumber: string; // e.g. 'NNSUCE/2026/01/0014'

  @Prop({ required: true })
  candidateName: string;

  @Prop({ required: true, enum: ['Male', 'Female'] })
  gender: string;

  @Prop({ required: true })
  schoolName: string;

  @Prop({ type: Types.ObjectId, ref: 'School' })
  schoolId?: Types.ObjectId;

  @Prop({ required: true })
  centerCode: string; // e.g. 'NAS-C01'

  @Prop()
  passportPhoto?: string;

  @Prop({ type: [String], default: ['English Language', 'Mathematics', 'Basic Science & Tech', 'National Values', 'Pre-Vocational Studies'] })
  subjects: string[];

  @Prop({ required: true })
  securityToken: string; // unique cryptographic hash for barcode/QR to prevent duplication

  @Prop({ default: '2025/2026' })
  academicSession: string;

  @Prop({ enum: ['registered', 'verified', 'sat', 'absent', 'flagged'], default: 'registered' })
  status: string;
}

export const NnsuceCandidateSchema = SchemaFactory.createForClass(NnsuceCandidate);
NnsuceCandidateSchema.index({ examNumber: 1 });
NnsuceCandidateSchema.index({ centerCode: 1 });
NnsuceCandidateSchema.index({ schoolName: 1 });
