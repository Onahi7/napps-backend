import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProprietorsService } from './proprietors.service';
import {
  CreateProprietorDto,
  UpdateProprietorDto,
  ProprietorLookupDto,
  ProprietorQueryDto,
  CsvImportDto,
  CsvImportResultDto,
} from './dto/proprietor.dto';

@ApiTags('Proprietors')
@Controller('proprietors')
export class ProprietorsController {
  constructor(private readonly proprietorsService: ProprietorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new proprietor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Proprietor successfully created',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Proprietor with email or phone already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async create(@Body() createProprietorDto: CreateProprietorDto) {
    return await this.proprietorsService.create(createProprietorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all proprietors with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'registrationStatus', required: false, enum: ['pending', 'approved', 'suspended', 'rejected'] })
  @ApiQuery({ name: 'nappsRegistered', required: false, enum: ['Not Registered', 'Registered', 'Registered with Certificate'] })
  @ApiQuery({ name: 'clearingStatus', required: false, enum: ['pending', 'cleared', 'outstanding'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['firstName', 'lastName', 'email', 'createdAt', 'totalAmountDue'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proprietors retrieved successfully',
  })
  async findAll(@Query() query: ProprietorQueryDto) {
    return await this.proprietorsService.findAll(query);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup proprietor by email, phone, registration number, or membership ID' })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'phone', required: false, type: String })
  @ApiQuery({ name: 'registrationNumber', required: false, type: String })
  @ApiQuery({ name: 'nappsMembershipId', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proprietors found matching the lookup criteria',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'At least one lookup parameter must be provided',
  })
  async lookup(@Query() lookupDto: ProprietorLookupDto) {
    return await this.proprietorsService.lookup(lookupDto);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get proprietors statistics (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async getStats() {
    return await this.proprietorsService.getStats();
  }

  @Post('import/csv')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import proprietors from CSV file (Admin only)' })
  @ApiBody({
    description: 'CSV file with proprietor data',
    type: CsvImportDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV import completed successfully',
    type: CsvImportResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file format or missing file',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto: CsvImportDto
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    return await this.proprietorsService.importFromCsv(
      file.buffer,
      importDto.skipValidation,
      importDto.updateExisting
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a proprietor by ID' })
  @ApiParam({ name: 'id', description: 'Proprietor ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proprietor found successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proprietor not found',
  })
  async findOne(@Param('id') id: string) {
    return await this.proprietorsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a proprietor (Admin only)' })
  @ApiParam({ name: 'id', description: 'Proprietor ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proprietor updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proprietor not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or phone already exists',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async update(@Param('id') id: string, @Body() updateProprietorDto: UpdateProprietorDto) {
    return await this.proprietorsService.update(id, updateProprietorDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a proprietor (Admin only)' })
  @ApiParam({ name: 'id', description: 'Proprietor ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proprietor deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proprietor not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async remove(@Param('id') id: string) {
    await this.proprietorsService.remove(id);
    return { message: 'Proprietor deleted successfully' };
  }
}