import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CmsService } from '../services/cms.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import {
  CreateHomepageContentDto,
  UpdateHomepageContentDto,
  HomepageContentQueryDto,
  CreateTeamMemberDto,
  UpdateTeamMemberDto,
  TeamMemberQueryDto,
  FileUploadResponseDto,
  NewsletterDto,
  EventNotificationDto,
} from '../dto/cms.dto';
import { HomepageContentDocument } from '../../schemas/homepage-content.schema';
import { TeamMemberDocument } from '../../schemas/team-member.schema';

@ApiTags('CMS - Content Management System')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  // =============== PUBLIC HOMEPAGE API ===============

  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage data for public website' })
  @ApiResponse({ status: 200, description: 'Homepage data retrieved successfully' })
  async getHomepageData() {
    return await this.cmsService.getHomepageData();
  }

  @Get('team/featured')
  @ApiOperation({ summary: 'Get featured team members' })
  @ApiResponse({ status: 200, description: 'Featured team members retrieved successfully' })
  async getFeaturedTeamMembers() {
    return await this.cmsService.getFeaturedTeamMembers();
  }

  @Get('team/leadership')
  @ApiOperation({ summary: 'Get leadership team' })
  @ApiResponse({ status: 200, description: 'Leadership team retrieved successfully' })
  async getLeadershipTeam() {
    return await this.cmsService.getLeadershipTeam();
  }

  @Get('elder-omaku')
  @ApiOperation({ summary: 'Get Elder Omaku information' })
  @ApiResponse({ status: 200, description: 'Elder Omaku info retrieved successfully' })
  async getElderOmakuInfo() {
    return await this.cmsService.getElderOmakuInfo();
  }

  // =============== ADMIN HOMEPAGE CONTENT MANAGEMENT ===============

  @Post('admin/content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new homepage content (Admin only)' })
  @ApiResponse({ status: 201, description: 'Homepage content created successfully' })
  async createHomepageContent(@Body() createDto: CreateHomepageContentDto): Promise<HomepageContentDocument> {
    return await this.cmsService.createHomepageContent(createDto);
  }

  @Get('admin/content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all homepage content with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Homepage content retrieved successfully' })
  async findAllHomepageContent(@Query() query: HomepageContentQueryDto) {
    return await this.cmsService.findAllHomepageContent(query);
  }

  @Get('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get homepage content by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Homepage content retrieved successfully' })
  async findHomepageContentById(@Param('id') id: string): Promise<HomepageContentDocument> {
    return await this.cmsService.findHomepageContentByKey(id);
  }

  @Put('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update homepage content (Admin only)' })
  @ApiResponse({ status: 200, description: 'Homepage content updated successfully' })
  async updateHomepageContent(
    @Param('id') id: string,
    @Body() updateDto: UpdateHomepageContentDto,
  ): Promise<HomepageContentDocument> {
    return await this.cmsService.updateHomepageContent(id, updateDto);
  }

  @Delete('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete homepage content (Admin only)' })
  @ApiResponse({ status: 200, description: 'Homepage content deleted successfully' })
  async deleteHomepageContent(@Param('id') id: string) {
    return await this.cmsService.deleteHomepageContent(id);
  }

  // =============== ADMIN TEAM MEMBER MANAGEMENT ===============

  @Post('admin/team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add new team member (Admin only)' })
  @ApiResponse({ status: 201, description: 'Team member created successfully' })
  async createTeamMember(@Body() createDto: CreateTeamMemberDto): Promise<TeamMemberDocument> {
    return await this.cmsService.createTeamMember(createDto);
  }

  @Get('admin/team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all team members with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team members retrieved successfully' })
  async findAllTeamMembers(@Query() query: TeamMemberQueryDto) {
    return await this.cmsService.findAllTeamMembers(query);
  }

  @Get('admin/team/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get team member by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team member retrieved successfully' })
  async findTeamMemberById(@Param('id') id: string): Promise<TeamMemberDocument> {
    return await this.cmsService.findTeamMemberById(id);
  }

  @Put('admin/team/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team member (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team member updated successfully' })
  async updateTeamMember(
    @Param('id') id: string,
    @Body() updateDto: UpdateTeamMemberDto,
  ): Promise<TeamMemberDocument> {
    return await this.cmsService.updateTeamMember(id, updateDto);
  }

  @Delete('admin/team/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete team member (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team member deleted successfully' })
  async deleteTeamMember(@Param('id') id: string) {
    return await this.cmsService.deleteTeamMember(id);
  }

  // =============== FILE UPLOAD ENDPOINTS ===============

  @Post('admin/upload/homepage-image/:contentKey/:imageType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload homepage image (Admin only)' })
  @ApiBody({
    description: 'Image file for homepage',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully', type: FileUploadResponseDto })
  async uploadHomepageImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('contentKey') contentKey: string,
    @Param('imageType') imageType: 'hero' | 'leadership' | 'gallery' | 'about',
  ): Promise<FileUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    return await this.cmsService.uploadHomepageImage(file.buffer, contentKey, imageType);
  }

  @Post('admin/upload/team-photo/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload team member photo (Admin only)' })
  @ApiBody({
    description: 'Image file for team member',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Photo uploaded successfully', type: FileUploadResponseDto })
  async uploadTeamMemberPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Param('memberId') memberId: string,
  ): Promise<FileUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    return await this.cmsService.uploadTeamMemberPhoto(file.buffer, memberId);
  }

  // =============== EMAIL COMMUNICATIONS ===============

  @Post('admin/send-newsletter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send newsletter to recipients (Admin only)' })
  @ApiResponse({ status: 200, description: 'Newsletter sent successfully' })
  async sendNewsletter(@Body() newsletterDto: NewsletterDto) {
    return await this.cmsService.sendNewsletter(newsletterDto);
  }

  @Post('admin/send-event-notification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send event notification (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event notification sent successfully' })
  async sendEventNotification(@Body() eventDto: EventNotificationDto) {
    return await this.cmsService.sendEventNotification(eventDto);
  }

  // =============== BULK OPERATIONS ===============

  @Patch('admin/team/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update team member order (Admin only)' })
  @ApiResponse({ status: 200, description: 'Team member order updated successfully' })
  async bulkUpdateTeamMemberOrder(
    @Body() updates: { id: string; sortOrder: number }[],
  ) {
    return await this.cmsService.bulkUpdateTeamMemberOrder(updates);
  }

  @Patch('admin/content/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update content order (Admin only)' })
  @ApiResponse({ status: 200, description: 'Content order updated successfully' })
  async bulkUpdateContentOrder(
    @Body() updates: { id: string; sortOrder: number }[],
  ) {
    return await this.cmsService.bulkUpdateContentOrder(updates);
  }

  // =============== ANALYTICS ===============

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get CMS analytics (Admin only)' })
  @ApiResponse({ status: 200, description: 'CMS analytics retrieved successfully' })
  async getCmsAnalytics() {
    return await this.cmsService.getCmsAnalytics();
  }

  // =============== CONTENT BY KEY ===============

  @Get('content/:contentKey')
  @ApiOperation({ summary: 'Get specific content by key (Public)' })
  @ApiResponse({ status: 200, description: 'Content retrieved successfully' })
  async getContentByKey(@Param('contentKey') contentKey: string): Promise<HomepageContentDocument> {
    return await this.cmsService.findHomepageContentByKey(contentKey);
  }

  @Get('team/public')
  @ApiOperation({ summary: 'Get active team members for public display' })
  @ApiResponse({ status: 200, description: 'Public team members retrieved successfully' })
  async getPublicTeamMembers(@Query() query: TeamMemberQueryDto) {
    // Force isActive to true for public endpoint
    const publicQuery = { ...query, isActive: true };
    return await this.cmsService.findAllTeamMembers(publicQuery);
  }

  // =============== HEALTH CHECK ===============

  @Get('health')
  @ApiOperation({ summary: 'CMS health check' })
  @ApiResponse({ status: 200, description: 'CMS service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'cms',
    };
  }
}