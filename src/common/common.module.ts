import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

// Services
import { FileUploadService } from './services/file-upload.service';
import { EmailService } from './services/email.service';
import { CmsService } from './services/cms.service';
import { FeeConfigurationService } from './services/fee-configuration.service';
import { FlutterwaveService } from './services/flutterwave.service';

// Controllers
import { CmsController } from './controllers/cms.controller';
import { FeeConfigurationController } from './controllers/fee-configuration.controller';
import { FastPaymentController } from './controllers/fast-payment.controller';
import { FlutterwaveWebhookController } from './controllers/flutterwave-webhook.controller';

// Schemas
import { HomepageContent, HomepageContentSchema } from '../schemas/homepage-content.schema';
import { TeamMember, TeamMemberSchema } from '../schemas/team-member.schema';
import { FeeConfiguration, FeeConfigurationSchema } from '../schemas/fee-configuration.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: HomepageContent.name, schema: HomepageContentSchema },
      { name: TeamMember.name, schema: TeamMemberSchema },
      { name: FeeConfiguration.name, schema: FeeConfigurationSchema },
    ]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [CmsController, FeeConfigurationController, FastPaymentController, FlutterwaveWebhookController],
  providers: [
    FileUploadService,
    EmailService,
    CmsService,
    FeeConfigurationService,
    FlutterwaveService,
  ],
  exports: [
    FileUploadService,
    EmailService,
    CmsService,
    FeeConfigurationService,
    FlutterwaveService,
  ],
})
export class CommonModule {}