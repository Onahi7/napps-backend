import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

// Services
import { FileUploadService } from './services/file-upload.service';
import { EmailService } from './services/email.service';
import { CmsService } from './services/cms.service';

// Controllers
import { CmsController } from './controllers/cms.controller';

// Schemas
import { HomepageContent, HomepageContentSchema } from '../schemas/homepage-content.schema';
import { TeamMember, TeamMemberSchema } from '../schemas/team-member.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: HomepageContent.name, schema: HomepageContentSchema },
      { name: TeamMember.name, schema: TeamMemberSchema },
    ]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [CmsController],
  providers: [
    FileUploadService,
    EmailService,
    CmsService,
  ],
  exports: [
    FileUploadService,
    EmailService,
    CmsService,
  ],
})
export class CommonModule {}