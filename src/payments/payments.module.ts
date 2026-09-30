import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FeeConfigurationController } from './fee-configuration.controller';
import { FeeConfigurationService } from './fee-configuration.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Proprietor, ProprietorSchema } from '../schemas/proprietor.schema';
import { School, SchoolSchema } from '../schemas/school.schema';
import { FeeConfiguration, FeeConfigurationSchema } from '../schemas/fee-configuration.schema';
import { EmailService } from '../common/services/email.service';

import { FidelityService } from './fidelity.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Proprietor.name, schema: ProprietorSchema },
      { name: School.name, schema: SchoolSchema },
      { name: FeeConfiguration.name, schema: FeeConfigurationSchema },
    ]),
  ],
  controllers: [PaymentsController, FeeConfigurationController],
  providers: [PaymentsService, FeeConfigurationService, FidelityService, EmailService],
  exports: [PaymentsService, FeeConfigurationService, FidelityService],
})
export class PaymentsModule {}