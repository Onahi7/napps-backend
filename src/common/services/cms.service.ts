import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { HomepageContent, HomepageContentDocument } from '../../schemas/homepage-content.schema';
import { TeamMember, TeamMemberDocument } from '../../schemas/team-member.schema';
import { FileUploadService, FileUploadResult } from './file-upload.service';
import { EmailService } from './email.service';
import {
  CreateHomepageContentDto,
  UpdateHomepageContentDto,
  HomepageContentQueryDto,
  CreateTeamMemberDto,
  UpdateTeamMemberDto,
  TeamMemberQueryDto,
  NewsletterDto,
  EventNotificationDto,
} from '../dto/cms.dto';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    @InjectModel(HomepageContent.name) private homepageContentModel: Model<HomepageContentDocument>,
    @InjectModel(TeamMember.name) private teamMemberModel: Model<TeamMemberDocument>,
    private fileUploadService: FileUploadService,
    private emailService: EmailService,
  ) {}

  // =============== HOMEPAGE CONTENT MANAGEMENT ===============

  async createHomepageContent(createDto: CreateHomepageContentDto): Promise<HomepageContentDocument> {
    try {
      // Check if content key already exists
      const existing = await this.homepageContentModel.findOne({ contentKey: createDto.contentKey });
      if (existing) {
        throw new BadRequestException(`Content with key '${createDto.contentKey}' already exists`);
      }

      const content = new this.homepageContentModel(createDto);
      await content.save();

      this.logger.log(`Homepage content created: ${createDto.contentKey}`);
      return content;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to create homepage content: ${error.message}`);
    }
  }

  async updateHomepageContent(id: string, updateDto: UpdateHomepageContentDto): Promise<HomepageContentDocument> {
    try {
      const content = await this.homepageContentModel.findByIdAndUpdate(
        id,
        updateDto,
        { new: true, runValidators: true }
      );

      if (!content) {
        throw new NotFoundException(`Homepage content with ID ${id} not found`);
      }

      this.logger.log(`Homepage content updated: ${content.contentKey}`);
      return content;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to update homepage content: ${error.message}`);
    }
  }

  async findAllHomepageContent(query: HomepageContentQueryDto): Promise<{
    data: HomepageContentDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit = 10, contentType, isActive } = query;

    const filter: FilterQuery<HomepageContentDocument> = {};
    if (contentType) filter.contentType = contentType;
    if (isActive !== undefined) filter.isActive = isActive;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.homepageContentModel
        .find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.homepageContentModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findHomepageContentByKey(contentKey: string): Promise<HomepageContentDocument> {
    const content = await this.homepageContentModel.findOne({ contentKey });
    if (!content) {
      throw new NotFoundException(`Homepage content with key '${contentKey}' not found`);
    }
    return content;
  }

  async deleteHomepageContent(id: string): Promise<{ success: boolean }> {
    try {
      const content = await this.homepageContentModel.findById(id);
      if (!content) {
        throw new NotFoundException(`Homepage content with ID ${id} not found`);
      }

      // Delete associated images from Cloudinary
      if (content.imagePublicId) {
        await this.fileUploadService.deleteFile(content.imagePublicId, 'image');
      }
      if (content.galleryPublicIds && content.galleryPublicIds.length > 0) {
        for (const publicId of content.galleryPublicIds) {
          await this.fileUploadService.deleteFile(publicId, 'image');
        }
      }

      await this.homepageContentModel.findByIdAndDelete(id);
      
      this.logger.log(`Homepage content deleted: ${content.contentKey}`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to delete homepage content: ${error.message}`);
    }
  }

  // =============== HOMEPAGE CONTENT IMAGE UPLOAD ===============

  async uploadHomepageImage(
    buffer: Buffer,
    contentKey: string,
    imageType: 'hero' | 'leadership' | 'gallery' | 'about'
  ): Promise<FileUploadResult> {
    try {
      const result = await this.fileUploadService.uploadHomepageImage(buffer, imageType, contentKey);
      
      // Update the content record with new image details
      await this.homepageContentModel.findOneAndUpdate(
        { contentKey },
        {
          imageUrl: result.url,
          imagePublicId: result.publicId,
        }
      );

      this.logger.log(`Homepage image uploaded for ${contentKey}: ${result.publicId}`);
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to upload homepage image: ${error.message}`);
    }
  }

  // =============== TEAM MEMBER MANAGEMENT ===============

  async createTeamMember(createDto: CreateTeamMemberDto): Promise<TeamMemberDocument> {
    try {
      const teamMember = new this.teamMemberModel(createDto);
      await teamMember.save();

      this.logger.log(`Team member created: ${teamMember.firstName} ${teamMember.lastName}`);
      return teamMember;
    } catch (error) {
      throw new BadRequestException(`Failed to create team member: ${error.message}`);
    }
  }

  async updateTeamMember(id: string, updateDto: UpdateTeamMemberDto): Promise<TeamMemberDocument> {
    try {
      const teamMember = await this.teamMemberModel.findByIdAndUpdate(
        id,
        updateDto,
        { new: true, runValidators: true }
      );

      if (!teamMember) {
        throw new NotFoundException(`Team member with ID ${id} not found`);
      }

      this.logger.log(`Team member updated: ${teamMember.firstName} ${teamMember.lastName}`);
      return teamMember;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to update team member: ${error.message}`);
    }
  }

  async findAllTeamMembers(query: TeamMemberQueryDto): Promise<{
    data: TeamMemberDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit = 10, category, role, isActive, isFeatured } = query;

    const filter: FilterQuery<TeamMemberDocument> = {};
    if (category) filter.category = category;
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;
    if (isFeatured !== undefined) filter.isFeatured = isFeatured;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.teamMemberModel
        .find(filter)
        .sort({ sortOrder: 1, lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.teamMemberModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findTeamMemberById(id: string): Promise<TeamMemberDocument> {
    const teamMember = await this.teamMemberModel.findById(id);
    if (!teamMember) {
      throw new NotFoundException(`Team member with ID ${id} not found`);
    }
    return teamMember;
  }

  async deleteTeamMember(id: string): Promise<{ success: boolean }> {
    try {
      const teamMember = await this.teamMemberModel.findById(id);
      if (!teamMember) {
        throw new NotFoundException(`Team member with ID ${id} not found`);
      }

      // Delete profile image from Cloudinary
      if (teamMember.profileImagePublicId) {
        await this.fileUploadService.deleteFile(teamMember.profileImagePublicId, 'image');
      }

      await this.teamMemberModel.findByIdAndDelete(id);
      
      this.logger.log(`Team member deleted: ${teamMember.firstName} ${teamMember.lastName}`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to delete team member: ${error.message}`);
    }
  }

  // =============== TEAM MEMBER IMAGE UPLOAD ===============

  async uploadTeamMemberPhoto(buffer: Buffer, memberId: string): Promise<FileUploadResult> {
    try {
      const teamMember = await this.findTeamMemberById(memberId);
      
      // Delete old image if exists
      if (teamMember.profileImagePublicId) {
        await this.fileUploadService.deleteFile(teamMember.profileImagePublicId, 'image');
      }

      const result = await this.fileUploadService.uploadTeamPhoto(buffer, memberId);
      
      // Update team member record with new image details
      await this.teamMemberModel.findByIdAndUpdate(memberId, {
        profileImageUrl: result.url,
        profileImagePublicId: result.publicId,
      });

      this.logger.log(`Team member photo uploaded: ${result.publicId}`);
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to upload team member photo: ${error.message}`);
    }
  }

  // =============== FEATURED CONTENT ===============

  async getFeaturedTeamMembers(): Promise<TeamMemberDocument[]> {
    return await this.teamMemberModel
      .find({ isActive: true, isFeatured: true })
      .sort({ sortOrder: 1, lastName: 1 })
      .limit(6)
      .exec();
  }

  async getLeadershipTeam(): Promise<TeamMemberDocument[]> {
    return await this.teamMemberModel
      .find({ 
        isActive: true, 
        category: { $in: ['executive', 'board', 'leadership'] }
      })
      .sort({ 
        category: 1, // executive first, then board, then leadership
        sortOrder: 1, 
        lastName: 1 
      })
      .exec();
  }

  async getElderOmakuInfo(): Promise<TeamMemberDocument | null> {
    return await this.teamMemberModel
      .findOne({ isActive: true, role: 'elder' })
      .exec();
  }

  // =============== PUBLIC HOMEPAGE API ===============

  async getHomepageData(): Promise<{
    heroSection: HomepageContentDocument | null;
    elderOmaku: TeamMemberDocument | null;
    featuredTeamMembers: TeamMemberDocument[];
    aboutSection: HomepageContentDocument | null;
    gallery: HomepageContentDocument[];
  }> {
    const [heroSection, elderOmaku, featuredTeamMembers, aboutSection, gallery] = await Promise.all([
      this.homepageContentModel.findOne({ contentKey: 'hero_section', isActive: true }),
      this.getElderOmakuInfo(),
      this.getFeaturedTeamMembers(),
      this.homepageContentModel.findOne({ contentKey: 'about_section', isActive: true }),
      this.homepageContentModel.find({ contentType: 'gallery', isActive: true }).sort({ sortOrder: 1 }).limit(10),
    ]);

    return {
      heroSection,
      elderOmaku,
      featuredTeamMembers,
      aboutSection,
      gallery,
    };
  }

  // =============== EMAIL COMMUNICATIONS ===============

  async sendNewsletter(newsletterDto: NewsletterDto): Promise<{ sent: number; failed: number }> {
    try {
      const result = await this.emailService.sendNewsletterEmail(
        newsletterDto.recipients,
        {
          title: newsletterDto.title,
          content: newsletterDto.content,
          featuredImage: newsletterDto.featuredImage,
        }
      );

      this.logger.log(`Newsletter sent: ${result.id}`);
      return { sent: 1, failed: 0 };
    } catch (error) {
      this.logger.error(`Newsletter sending failed: ${error.message}`);
      return { sent: 0, failed: 1 };
    }
  }

  async sendEventNotification(eventDto: EventNotificationDto): Promise<{ sent: number; failed: number }> {
    try {
      const result = await this.emailService.sendEventNotificationEmail(
        eventDto.recipients,
        {
          eventName: eventDto.eventName,
          eventDate: new Date(eventDto.eventDate),
          eventLocation: eventDto.eventLocation,
          description: eventDto.description,
          registrationLink: eventDto.registrationLink,
        }
      );

      this.logger.log(`Event notification sent: ${result.id}`);
      return { sent: 1, failed: 0 };
    } catch (error) {
      this.logger.error(`Event notification sending failed: ${error.message}`);
      return { sent: 0, failed: 1 };
    }
  }

  // =============== BULK OPERATIONS ===============

  async bulkUpdateTeamMemberOrder(updates: { id: string; sortOrder: number }[]): Promise<{ success: boolean }> {
    try {
      const bulkOps = updates.map(update => ({
        updateOne: {
          filter: { _id: update.id },
          update: { sortOrder: update.sortOrder },
        },
      }));

      await this.teamMemberModel.bulkWrite(bulkOps);
      
      this.logger.log(`Bulk updated team member order for ${updates.length} members`);
      return { success: true };
    } catch (error) {
      throw new BadRequestException(`Failed to bulk update team member order: ${error.message}`);
    }
  }

  async bulkUpdateContentOrder(updates: { id: string; sortOrder: number }[]): Promise<{ success: boolean }> {
    try {
      const bulkOps = updates.map(update => ({
        updateOne: {
          filter: { _id: update.id },
          update: { sortOrder: update.sortOrder },
        },
      }));

      await this.homepageContentModel.bulkWrite(bulkOps);
      
      this.logger.log(`Bulk updated content order for ${updates.length} items`);
      return { success: true };
    } catch (error) {
      throw new BadRequestException(`Failed to bulk update content order: ${error.message}`);
    }
  }

  // =============== ANALYTICS ===============

  async getCmsAnalytics(): Promise<{
    totalContent: number;
    totalTeamMembers: number;
    featuredMembers: number;
    activeContent: number;
    contentByType: { [key: string]: number };
    membersByCategory: { [key: string]: number };
  }> {
    const [
      totalContent,
      totalTeamMembers,
      featuredMembers,
      activeContent,
      contentByType,
      membersByCategory,
    ] = await Promise.all([
      this.homepageContentModel.countDocuments(),
      this.teamMemberModel.countDocuments(),
      this.teamMemberModel.countDocuments({ isFeatured: true }),
      this.homepageContentModel.countDocuments({ isActive: true }),
      this.homepageContentModel.aggregate([
        { $group: { _id: '$contentType', count: { $sum: 1 } } },
      ]),
      this.teamMemberModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalContent,
      totalTeamMembers,
      featuredMembers,
      activeContent,
      contentByType: contentByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      membersByCategory: membersByCategory.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }
}