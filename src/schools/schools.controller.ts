import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolsService } from './schools.service';
import {
  CreateSchoolDto,
  UpdateSchoolDto,
  SchoolQueryDto,
  CreateEnrollmentDto,
  UpdateEnrollmentDto,
  EnrollmentQueryDto,
} from './dto/school.dto';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  // =============== SCHOOL ENDPOINTS ===============

  @Post()
  @ApiOperation({ summary: 'Create a new school' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'School successfully created',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proprietor not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async createSchool(@Body() createSchoolDto: CreateSchoolDto) {
    return await this.schoolsService.createSchool(createSchoolDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'proprietorId', required: false, type: String })
  @ApiQuery({ name: 'lga', required: false, type: String })
  @ApiQuery({ name: 'aeqeoZone', required: false, type: String })
  @ApiQuery({ name: 'typeOfSchool', required: false, type: String })
  @ApiQuery({ name: 'categoryOfSchool', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isPrimary', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['schoolName', 'yearOfEstablishment', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schools retrieved successfully',
  })
  async findAllSchools(@Query() query: SchoolQueryDto) {
    return await this.schoolsService.findAllSchools(query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get schools statistics (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async getSchoolStats() {
    return await this.schoolsService.getSchoolStats();
  }

  @Get('proprietor/:proprietorId')
  @ApiOperation({ summary: 'Get all schools for a specific proprietor' })
  @ApiParam({ name: 'proprietorId', description: 'Proprietor ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schools found successfully',
  })
  async findSchoolsByProprietor(@Param('proprietorId') proprietorId: string) {
    return await this.schoolsService.findSchoolsByProprietor(proprietorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a school by ID' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School found successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  async findSchoolById(@Param('id') id: string) {
    return await this.schoolsService.findSchoolById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a school (Admin only)' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async updateSchool(@Param('id') id: string, @Body() updateSchoolDto: UpdateSchoolDto) {
    return await this.schoolsService.updateSchool(id, updateSchoolDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a school (Admin only)' })
  @ApiParam({ name: 'id', description: 'School ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'School deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete school with existing enrollments',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async deleteSchool(@Param('id') id: string) {
    await this.schoolsService.deleteSchool(id);
    return { message: 'School deleted successfully' };
  }

  // =============== ENROLLMENT ENDPOINTS ===============

  @Post('enrollments')
  @ApiOperation({ summary: 'Create enrollment data for a school' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Enrollment successfully created',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'School or proprietor not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Enrollment already exists for this academic year and term',
  })
  async createEnrollment(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return await this.schoolsService.createEnrollment(createEnrollmentDto);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'Get all enrollments with filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'proprietorId', required: false, type: String })
  @ApiQuery({ name: 'academicYear', required: false, type: String })
  @ApiQuery({ name: 'term', required: false, enum: ['First', 'Second', 'Third'] })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'submitted', 'verified', 'approved', 'rejected'] })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['academicYear', 'term', 'totalEnrollment', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollments retrieved successfully',
  })
  async findAllEnrollments(@Query() query: EnrollmentQueryDto) {
    return await this.schoolsService.findAllEnrollments(query);
  }

  @Get('enrollments/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get enrollment statistics (Admin only)' })
  @ApiQuery({ name: 'academicYear', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollment statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async getEnrollmentStats(@Query('academicYear') academicYear?: string) {
    return await this.schoolsService.getEnrollmentStats(academicYear);
  }

  @Get('enrollments/:id')
  @ApiOperation({ summary: 'Get enrollment by ID' })
  @ApiParam({ name: 'id', description: 'Enrollment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollment found successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  async findEnrollmentById(@Param('id') id: string) {
    return await this.schoolsService.findEnrollmentById(id);
  }

  @Patch('enrollments/:id')
  @ApiOperation({ summary: 'Update enrollment data' })
  @ApiParam({ name: 'id', description: 'Enrollment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollment updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  async updateEnrollment(@Param('id') id: string, @Body() updateEnrollmentDto: UpdateEnrollmentDto) {
    return await this.schoolsService.updateEnrollment(id, updateEnrollmentDto);
  }

  @Post('enrollments/:id/submit')
  @ApiOperation({ summary: 'Submit enrollment for review' })
  @ApiParam({ name: 'id', description: 'Enrollment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollment submitted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Only draft enrollments can be submitted',
  })
  async submitEnrollment(@Param('id') id: string) {
    return await this.schoolsService.submitEnrollment(id);
  }

  @Delete('enrollments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete enrollment (Admin only)' })
  @ApiParam({ name: 'id', description: 'Enrollment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollment deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async deleteEnrollment(@Param('id') id: string) {
    await this.schoolsService.deleteEnrollment(id);
    return { message: 'Enrollment deleted successfully' };
  }
}