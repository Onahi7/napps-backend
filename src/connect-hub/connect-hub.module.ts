import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectHubController } from './connect-hub.controller';
import { ConnectHubService } from './connect-hub.service';
import { ConnectHubSeederService } from './connect-hub-seeder.service';
import { HeroImage, HeroImageSchema } from '../schemas/hero-image.schema';
import { Member, MemberSchema } from '../schemas/member.schema';
import { Announcement, AnnouncementSchema } from '../schemas/announcement.schema';
import { SiteSetting, SiteSettingSchema } from '../schemas/site-setting.schema';
import { PageContent, PageContentSchema } from '../schemas/page-content.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HeroImage.name, schema: HeroImageSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: SiteSetting.name, schema: SiteSettingSchema },
      { name: PageContent.name, schema: PageContentSchema },
    ]),
  ],
  controllers: [ConnectHubController],
  providers: [ConnectHubService, ConnectHubSeederService],
  exports: [ConnectHubService],
})
export class ConnectHubModule {}