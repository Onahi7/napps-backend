import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { LevyPaymentsController } from './levy-payments.controller';
import { LevyPaymentsService } from './levy-payments.service';
import { PostgresSchoolsService } from './postgres-schools.service';
import { LevyPayment, LevyPaymentSchema } from '../schemas/levy-payment.schema';
import { Proprietor, ProprietorSchema } from '../schemas/proprietor.schema';
import { School, SchoolSchema } from '../schemas/school.schema';

import { EmailService } from '../common/services/email.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: LevyPayment.name, schema: LevyPaymentSchema },
      { name: Proprietor.name, schema: ProprietorSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
  ],
  controllers: [LevyPaymentsController],
  providers: [
    LevyPaymentsService,
    PostgresSchoolsService,
    EmailService,
  ],
  exports: [LevyPaymentsService, PostgresSchoolsService],
})
export class LevyPaymentsModule {}
