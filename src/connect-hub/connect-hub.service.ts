import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HeroImage, HeroImageDocument } from '../schemas/hero-image.schema';
import { Member, MemberDocument } from '../schemas/member.schema';
import { Announcement, AnnouncementDocument } from '../schemas/announcement.schema';
import { SiteSetting, SiteSettingDocument } from '../schemas/site-setting.schema';
import { PageContent, PageContentDocument } from '../schemas/page-content.schema';
import {
  CreateHeroImageDto,
  UpdateHeroImageDto,
  CreateMemberDto,
  UpdateMemberDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  CreateSiteSettingDto,
  UpdateSiteSettingDto,
  CreatePageContentDto,
  UpdatePageContentDto,
  QueryDto
} from '../dto/connect-hub.dto';

@Injectable()
export class ConnectHubService {
  constructor(
    @InjectModel(HeroImage.name) private heroImageModel: Model<HeroImageDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Announcement.name) private announcementModel: Model<AnnouncementDocument>,
    @InjectModel(SiteSetting.name) private siteSettingModel: Model<SiteSettingDocument>,
    @InjectModel(PageContent.name) private pageContentModel: Model<PageContentDocument>,
  ) {}

  // =============== HERO IMAGES ===============

  async findAllHeroImages(query: QueryDto) {
    const { page = 1, limit = 10, isActive, search } = query;
    const filter: any = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.heroImageModel
        .find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.heroImageModel.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findActiveHeroImages() {
    return this.heroImageModel
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .exec();
  }

  async findHeroImageById(id: string): Promise<HeroImageDocument> {
    const heroImage = await this.heroImageModel.findById(id).exec();
    if (!heroImage) {
      throw new NotFoundException('Hero image not found');
    }
    return heroImage;
  }

  async createHeroImage(createDto: CreateHeroImageDto): Promise<HeroImageDocument> {
    const heroImage = new this.heroImageModel(createDto);
    return heroImage.save();
  }

  async updateHeroImage(id: string, updateDto: UpdateHeroImageDto): Promise<HeroImageDocument> {
    const heroImage = await this.heroImageModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    
    if (!heroImage) {
      throw new NotFoundException('Hero image not found');
    }
    
    return heroImage;
  }

  async deleteHeroImage(id: string): Promise<void> {
    const result = await this.heroImageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Hero image not found');
    }
  }

  // =============== MEMBERS ===============

  async findAllMembers(query: QueryDto) {
    const { page = 1, limit = 10, isActive, search } = query;
    const filter: any = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.memberModel
        .find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findActiveMembers() {
    return this.memberModel
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .exec();
  }

  async findMemberById(id: string): Promise<MemberDocument> {
    const member = await this.memberModel.findById(id).exec();
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  async createMember(createDto: CreateMemberDto): Promise<MemberDocument> {
    const member = new this.memberModel(createDto);
    return member.save();
  }

  async updateMember(id: string, updateDto: UpdateMemberDto): Promise<MemberDocument> {
    const member = await this.memberModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    
    return member;
  }

  async deleteMember(id: string): Promise<void> {
    const result = await this.memberModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Member not found');
    }
  }

  // =============== ANNOUNCEMENTS ===============

  async findAllAnnouncements(query: QueryDto) {
    const { page = 1, limit = 10, isActive, search } = query;
    const filter: any = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.announcementModel
        .find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.announcementModel.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findActiveAnnouncements() {
    const now = new Date();
    return this.announcementModel
      .find({ 
        isActive: true,
        $and: [
          {
            $or: [
              { startDate: { $exists: false } },
              { startDate: null },
              { startDate: { $lte: now } }
            ]
          },
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: null },
              { endDate: { $gte: now } }
            ]
          }
        ]
      })
      .sort({ displayOrder: 1 })
      .exec();
  }

  async findAnnouncementById(id: string): Promise<AnnouncementDocument> {
    const announcement = await this.announcementModel.findById(id).exec();
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async createAnnouncement(createDto: CreateAnnouncementDto): Promise<AnnouncementDocument> {
    const announcement = new this.announcementModel(createDto);
    return announcement.save();
  }

  async updateAnnouncement(id: string, updateDto: UpdateAnnouncementDto): Promise<AnnouncementDocument> {
    const announcement = await this.announcementModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    const result = await this.announcementModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Announcement not found');
    }
  }

  // =============== SITE SETTINGS ===============

  async findAllSiteSettings(query: QueryDto) {
    const { page = 1, limit = 50, search } = query;
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { settingKey: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.siteSettingModel
        .find(filter)
        .sort({ settingKey: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.siteSettingModel.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findPublicSiteSettings() {
    return this.siteSettingModel
      .find({ isPublic: true })
      .sort({ settingKey: 1 })
      .exec();
  }

  async findSiteSettingByKey(key: string): Promise<SiteSettingDocument> {
    const setting = await this.siteSettingModel.findOne({ settingKey: key }).exec();
    if (!setting) {
      throw new NotFoundException('Site setting not found');
    }
    return setting;
  }

  async createSiteSetting(createDto: CreateSiteSettingDto): Promise<SiteSettingDocument> {
    const setting = new this.siteSettingModel(createDto);
    return setting.save();
  }

  async updateSiteSetting(key: string, updateDto: UpdateSiteSettingDto): Promise<SiteSettingDocument> {
    const setting = await this.siteSettingModel
      .findOneAndUpdate({ settingKey: key }, updateDto, { new: true })
      .exec();
    
    if (!setting) {
      throw new NotFoundException('Site setting not found');
    }
    
    return setting;
  }

  async deleteSiteSetting(key: string): Promise<void> {
    const result = await this.siteSettingModel.findOneAndDelete({ settingKey: key }).exec();
    if (!result) {
      throw new NotFoundException('Site setting not found');
    }
  }

  // =============== PAGE CONTENT ===============

  async findAllPageContent(query: QueryDto) {
    const { page = 1, limit = 10, isActive, search } = query;
    const filter: any = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    if (search) {
      filter.$or = [
        { pageName: { $regex: search, $options: 'i' } },
        { sectionName: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.pageContentModel
        .find(filter)
        .sort({ pageName: 1, displayOrder: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.pageContentModel.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findPageContent(pageName: string, sectionName?: string) {
    const filter: any = { pageName, isActive: true };
    if (sectionName) {
      filter.sectionName = sectionName;
    }

    return this.pageContentModel
      .find(filter)
      .sort({ displayOrder: 1 })
      .exec();
  }

  async findPageContentById(id: string): Promise<PageContentDocument> {
    const content = await this.pageContentModel.findById(id).exec();
    if (!content) {
      throw new NotFoundException('Page content not found');
    }
    return content;
  }

  async createPageContent(createDto: CreatePageContentDto): Promise<PageContentDocument> {
    const content = new this.pageContentModel(createDto);
    return content.save();
  }

  async updatePageContent(id: string, updateDto: UpdatePageContentDto): Promise<PageContentDocument> {
    const content = await this.pageContentModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    
    if (!content) {
      throw new NotFoundException('Page content not found');
    }
    
    return content;
  }

  async deletePageContent(id: string): Promise<void> {
    const result = await this.pageContentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Page content not found');
    }
  }

  // =============== ANALYTICS ===============

  async getAnalytics() {
    const [
      totalHeroImages,
      activeHeroImages,
      totalMembers,
      activeMembers,
      totalAnnouncements,
      activeAnnouncements,
      totalSettings,
      totalContent,
      activeContent
    ] = await Promise.all([
      this.heroImageModel.countDocuments(),
      this.heroImageModel.countDocuments({ isActive: true }),
      this.memberModel.countDocuments(),
      this.memberModel.countDocuments({ isActive: true }),
      this.announcementModel.countDocuments(),
      this.announcementModel.countDocuments({ isActive: true }),
      this.siteSettingModel.countDocuments(),
      this.pageContentModel.countDocuments(),
      this.pageContentModel.countDocuments({ isActive: true })
    ]);

    return {
      heroImages: {
        total: totalHeroImages,
        active: activeHeroImages
      },
      members: {
        total: totalMembers,
        active: activeMembers
      },
      announcements: {
        total: totalAnnouncements,
        active: activeAnnouncements
      },
      settings: {
        total: totalSettings
      },
      content: {
        total: totalContent,
        active: activeContent
      }
    };
  }
}