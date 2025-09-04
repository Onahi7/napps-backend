import {
  Controller,
  Get,
  Post,
  Put,
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
  ApiParam,
} from '@nestjs/swagger';
import { ConnectHubService } from './connect-hub.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
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

@ApiTags('Connect Hub - Content Management')
@Controller('connect-hub')
export class ConnectHubController {
  constructor(private readonly connectHubService: ConnectHubService) {}

  // =============== PUBLIC ENDPOINTS ===============

  @Get('hero-images')
  @ApiOperation({ summary: 'Get active hero images for public display' })
  @ApiResponse({ status: 200, description: 'Active hero images retrieved successfully' })
  async getActiveHeroImages() {
    return this.connectHubService.findActiveHeroImages();
  }

  @Get('members')
  @ApiOperation({ summary: 'Get active members for public display' })
  @ApiResponse({ status: 200, description: 'Active members retrieved successfully' })
  async getActiveMembers() {
    return this.connectHubService.findActiveMembers();
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get active announcements for public display' })
  @ApiResponse({ status: 200, description: 'Active announcements retrieved successfully' })
  async getActiveAnnouncements() {
    return this.connectHubService.findActiveAnnouncements();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get public site settings' })
  @ApiResponse({ status: 200, description: 'Public site settings retrieved successfully' })
  async getPublicSettings() {
    return this.connectHubService.findPublicSiteSettings();
  }

  @Get('content/:pageName')
  @ApiOperation({ summary: 'Get page content by page name' })
  @ApiParam({ name: 'pageName', description: 'Name of the page' })
  @ApiResponse({ status: 200, description: 'Page content retrieved successfully' })
  async getPageContent(
    @Param('pageName') pageName: string,
    @Query('section') sectionName?: string
  ) {
    return this.connectHubService.findPageContent(pageName, sectionName);
  }

  // =============== ADMIN HERO IMAGES MANAGEMENT ===============

  @Get('admin/hero-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all hero images with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hero images retrieved successfully' })
  async findAllHeroImages(@Query() query: QueryDto) {
    return this.connectHubService.findAllHeroImages(query);
  }

  @Get('admin/hero-images/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get hero image by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hero image retrieved successfully' })
  async findHeroImageById(@Param('id') id: string) {
    return this.connectHubService.findHeroImageById(id);
  }

  @Post('admin/hero-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new hero image (Admin only)' })
  @ApiResponse({ status: 201, description: 'Hero image created successfully' })
  async createHeroImage(@Body() createDto: CreateHeroImageDto) {
    return this.connectHubService.createHeroImage(createDto);
  }

  @Put('admin/hero-images/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hero image (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hero image updated successfully' })
  async updateHeroImage(
    @Param('id') id: string,
    @Body() updateDto: UpdateHeroImageDto
  ) {
    return this.connectHubService.updateHeroImage(id, updateDto);
  }

  @Delete('admin/hero-images/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete hero image (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hero image deleted successfully' })
  async deleteHeroImage(@Param('id') id: string) {
    await this.connectHubService.deleteHeroImage(id);
    return { message: 'Hero image deleted successfully' };
  }

  // =============== ADMIN MEMBERS MANAGEMENT ===============

  @Get('admin/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all members with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  async findAllMembers(@Query() query: QueryDto) {
    return this.connectHubService.findAllMembers(query);
  }

  @Get('admin/members/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get member by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully' })
  async findMemberById(@Param('id') id: string) {
    return this.connectHubService.findMemberById(id);
  }

  @Post('admin/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new member (Admin only)' })
  @ApiResponse({ status: 201, description: 'Member created successfully' })
  async createMember(@Body() createDto: CreateMemberDto) {
    return this.connectHubService.createMember(createDto);
  }

  @Put('admin/members/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member (Admin only)' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  async updateMember(
    @Param('id') id: string,
    @Body() updateDto: UpdateMemberDto
  ) {
    return this.connectHubService.updateMember(id, updateDto);
  }

  @Delete('admin/members/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete member (Admin only)' })
  @ApiResponse({ status: 200, description: 'Member deleted successfully' })
  async deleteMember(@Param('id') id: string) {
    await this.connectHubService.deleteMember(id);
    return { message: 'Member deleted successfully' };
  }

  // =============== ADMIN ANNOUNCEMENTS MANAGEMENT ===============

  @Get('admin/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all announcements with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcements retrieved successfully' })
  async findAllAnnouncements(@Query() query: QueryDto) {
    return this.connectHubService.findAllAnnouncements(query);
  }

  @Get('admin/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get announcement by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcement retrieved successfully' })
  async findAnnouncementById(@Param('id') id: string) {
    return this.connectHubService.findAnnouncementById(id);
  }

  @Post('admin/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new announcement (Admin only)' })
  @ApiResponse({ status: 201, description: 'Announcement created successfully' })
  async createAnnouncement(@Body() createDto: CreateAnnouncementDto) {
    return this.connectHubService.createAnnouncement(createDto);
  }

  @Put('admin/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update announcement (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcement updated successfully' })
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() updateDto: UpdateAnnouncementDto
  ) {
    return this.connectHubService.updateAnnouncement(id, updateDto);
  }

  @Delete('admin/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete announcement (Admin only)' })
  @ApiResponse({ status: 200, description: 'Announcement deleted successfully' })
  async deleteAnnouncement(@Param('id') id: string) {
    await this.connectHubService.deleteAnnouncement(id);
    return { message: 'Announcement deleted successfully' };
  }

  // =============== ADMIN SITE SETTINGS MANAGEMENT ===============

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all site settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Site settings retrieved successfully' })
  async findAllSettings(@Query() query: QueryDto) {
    return this.connectHubService.findAllSiteSettings(query);
  }

  @Get('admin/settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get site setting by key (Admin only)' })
  @ApiResponse({ status: 200, description: 'Site setting retrieved successfully' })
  async findSettingByKey(@Param('key') key: string) {
    return this.connectHubService.findSiteSettingByKey(key);
  }

  @Post('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new site setting (Admin only)' })
  @ApiResponse({ status: 201, description: 'Site setting created successfully' })
  async createSetting(@Body() createDto: CreateSiteSettingDto) {
    return this.connectHubService.createSiteSetting(createDto);
  }

  @Put('admin/settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update site setting (Admin only)' })
  @ApiResponse({ status: 200, description: 'Site setting updated successfully' })
  async updateSetting(
    @Param('key') key: string,
    @Body() updateDto: UpdateSiteSettingDto
  ) {
    return this.connectHubService.updateSiteSetting(key, updateDto);
  }

  @Delete('admin/settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete site setting (Admin only)' })
  @ApiResponse({ status: 200, description: 'Site setting deleted successfully' })
  async deleteSetting(@Param('key') key: string) {
    await this.connectHubService.deleteSiteSetting(key);
    return { message: 'Site setting deleted successfully' };
  }

  // =============== ADMIN PAGE CONTENT MANAGEMENT ===============

  @Get('admin/content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all page content (Admin only)' })
  @ApiResponse({ status: 200, description: 'Page content retrieved successfully' })
  async findAllContent(@Query() query: QueryDto) {
    return this.connectHubService.findAllPageContent(query);
  }

  @Get('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get page content by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Page content retrieved successfully' })
  async findContentById(@Param('id') id: string) {
    return this.connectHubService.findPageContentById(id);
  }

  @Post('admin/content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new page content (Admin only)' })
  @ApiResponse({ status: 201, description: 'Page content created successfully' })
  async createContent(@Body() createDto: CreatePageContentDto) {
    return this.connectHubService.createPageContent(createDto);
  }

  @Put('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update page content (Admin only)' })
  @ApiResponse({ status: 200, description: 'Page content updated successfully' })
  async updateContent(
    @Param('id') id: string,
    @Body() updateDto: UpdatePageContentDto
  ) {
    return this.connectHubService.updatePageContent(id, updateDto);
  }

  @Delete('admin/content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete page content (Admin only)' })
  @ApiResponse({ status: 200, description: 'Page content deleted successfully' })
  async deleteContent(@Param('id') id: string) {
    await this.connectHubService.deletePageContent(id);
    return { message: 'Page content deleted successfully' };
  }

  // =============== ANALYTICS ===============

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get connect hub analytics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics() {
    return this.connectHubService.getAnalytics();
  }

  // =============== HEALTH CHECK ===============

  @Get('health')
  @ApiOperation({ summary: 'Connect Hub health check' })
  @ApiResponse({ status: 200, description: 'Connect Hub service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'connect-hub',
    };
  }
}