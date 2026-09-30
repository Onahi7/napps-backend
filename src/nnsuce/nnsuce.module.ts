import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NnsuceCenter, NnsuceCenterSchema } from './schemas/nnsuce-center.schema';
import { NnsuceCandidate, NnsuceCandidateSchema } from './schemas/nnsuce-candidate.schema';
import { NnsuceResult, NnsuceResultSchema } from './schemas/nnsuce-result.schema';
import { NnsuceService } from './nnsuce.service';
import { NnsuceController } from './nnsuce.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NnsuceCenter.name, schema: NnsuceCenterSchema },
      { name: NnsuceCandidate.name, schema: NnsuceCandidateSchema },
      { name: NnsuceResult.name, schema: NnsuceResultSchema },
    ]),
  ],
  controllers: [NnsuceController],
  providers: [NnsuceService],
  exports: [NnsuceService],
})
export class NnsuceModule {}
