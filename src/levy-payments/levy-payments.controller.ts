import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LevyPaymentsService } from './levy-payments.service';
import { PostgresSchoolsService } from './postgres-schools.service';
import {
  InitializeLevyPaymentDto,
  VerifyLevyPaymentDto,
  CheckDuplicateDto,
  LevyPaymentQueryDto,
  DownloadReceiptDto,
} from '../dto/levy-payment.dto';

@ApiTags('Levy Payments')
@Controller('levy-payments')
export class LevyPaymentsController {
  private readonly logger = new Logger(LevyPaymentsController.name);

  constructor(
    private readonly levyPaymentsService: LevyPaymentsService,
    private readonly postgresSchoolsService: PostgresSchoolsService,
  ) {}

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize a new levy payment' })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment initialized successfully',
    schema: {
      type: 'object',
      properties: {
        reference: { type: 'string' },
        paymentUrl: { type: 'string' },
        amount: { type: 'number' },
        receiptNumber: { type: 'string' },
      },
    },
  })
  async initializePayment(@Body() initializeLevyPaymentDto: InitializeLevyPaymentDto) {
    this.logger.log(`Initializing levy payment for ${initializeLevyPaymentDto.email}`);
    return await this.levyPaymentsService.initializePayment(initializeLevyPaymentDto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a levy payment' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  async verifyPayment(@Body() verifyLevyPaymentDto: VerifyLevyPaymentDto) {
    this.logger.log(`Verifying levy payment: ${verifyLevyPaymentDto.reference}`);
    return await this.levyPaymentsService.verifyPayment(verifyLevyPaymentDto);
  }

  @Get('verify/:reference')
  @ApiOperation({ summary: 'Verify payment by reference' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  async verifyPaymentByReference(@Param('reference') reference: string) {
    this.logger.log(`Verifying levy payment by reference: ${reference}`);
    return await this.levyPaymentsService.verifyPayment({ reference });
  }

  @Post('check-duplicate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check for duplicate email/phone' })
  @ApiResponse({ 
    status: 200, 
    description: 'Duplicate check completed',
    schema: {
      type: 'object',
      properties: {
        isDuplicate: { type: 'boolean' },
        canContinue: { type: 'boolean' },
        payment: { type: 'object' },
      },
    },
  })
  async checkDuplicate(@Body() checkDuplicateDto: CheckDuplicateDto) {
    return await this.levyPaymentsService.checkDuplicate(checkDuplicateDto);
  }

  @Get('schools')
  @ApiOperation({ summary: 'Get all schools for dropdown (optionally filtered by chapter)' })
  @ApiQuery({ name: 'chapter', required: false, description: 'Filter schools by chapter name' })
  @ApiResponse({ 
    status: 200, 
    description: 'Schools retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          lga: { type: 'string' },
          chapter: { type: 'string' },
        },
      },
    },
  })
  async getAllSchools(@Query('chapter') chapter?: string) {
    return await this.levyPaymentsService.getAllSchools(chapter);
  }

  @Get('schools/postgres')
  @ApiOperation({ summary: 'Get schools from PostgreSQL database (with accurate chapter mappings)' })
  @ApiQuery({ name: 'chapter', required: false, description: 'Filter schools by chapter name' })
  @ApiResponse({ 
    status: 200, 
    description: 'Schools retrieved successfully from PostgreSQL',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          lga: { type: 'string' },
          chapter: { type: 'string' },
        },
      },
    },
  })
  async getSchoolsFromPostgres(@Query('chapter') chapter?: string) {
    this.logger.log(`Fetching schools from PostgreSQL${chapter ? ` for chapter: ${chapter}` : ''}`);
    return await this.postgresSchoolsService.getSchoolsByChapter(chapter);
  }

  @Get('chapters/postgres')
  @ApiOperation({ summary: 'Get all chapters from PostgreSQL database' })
  @ApiResponse({ 
    status: 200, 
    description: 'Chapters retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
        },
      },
    },
  })
  async getChaptersFromPostgres() {
    this.logger.log('Fetching chapters from PostgreSQL');
    return await this.postgresSchoolsService.getAllChapters();
  }

  @Get('chapters/stats')
  @ApiOperation({ summary: 'Get school count by chapter from PostgreSQL' })
  @ApiResponse({ 
    status: 200, 
    description: 'Chapter statistics retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
    },
  })
  async getChapterStats() {
    this.logger.log('Fetching chapter statistics from PostgreSQL');
    return await this.postgresSchoolsService.getSchoolCountByChapter();
  }

  @Get()
  @ApiOperation({ summary: 'Get all levy payments with filters' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async findAllPayments(@Query() query: LevyPaymentQueryDto) {
    return await this.levyPaymentsService.findAllPayments(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get levy payment statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.levyPaymentsService.getStats(startDate, endDate);
  }

  @Get('by-identifier/:identifier')
  @ApiOperation({ summary: 'Get payments by email or phone (for receipt download)' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async findByIdentifier(@Param('identifier') identifier: string) {
    this.logger.log(`Finding payments by identifier: ${identifier}`);
    return await this.levyPaymentsService.findByIdentifier(identifier);
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Get payment by reference' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  async findByReference(@Param('reference') reference: string) {
    return await this.levyPaymentsService.findByReference(reference);
  }
}
