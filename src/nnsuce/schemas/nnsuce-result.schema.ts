import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NnsuceResultDocument = NnsuceResult & Document;

@Schema({ timestamps: true })
export class NnsuceResult {
  @Prop({ required: true, unique: true })
  examNumber: string;

  @Prop({ required: true })
  candidateName: string;

  @Prop({ required: true })
  schoolName: string;

  @Prop({ required: true })
  centerCode: string;

  @Prop({ type: Object, required: true })
  subjectScores: Record<string, { score: number; maxScore: number; grade: string }>;

  @Prop({ required: true })
  totalScore: number;

  @Prop({ required: true })
  averagePercentage: number;

  @Prop({ required: true })
  overallGrade: string; // Distinction, Merit, Pass, Fail

  @Prop({ type: Object, default: {} })
  omrAuditData?: {
    scannedAt?: Date;
    scannerDevice?: string;
    sheetImageUrl?: string;
    totalBubblesDetected?: number;
    doubleMarkedQuestions?: number[];
    blankQuestions?: number[];
    aiConfidenceScore?: number;
    anomalyFlag?: boolean;
    anomalyNotes?: string;
  };

  @Prop({ default: '2025/2026' })
  academicSession: string;

  @Prop({ default: true })
  isPublished: boolean;
}

export const NnsuceResultSchema = SchemaFactory.createForClass(NnsuceResult);
NnsuceResultSchema.index({ examNumber: 1 });
NnsuceResultSchema.index({ centerCode: 1 });
NnsuceResultSchema.index({ schoolName: 1 });
