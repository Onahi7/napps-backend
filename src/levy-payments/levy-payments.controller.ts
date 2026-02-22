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
  ApiBearerAuth 
} from '@nestjs/swagger';
import { LevyPaymentsService } from './levy-payments.service';
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

  constructor(private readonly levyPaymentsService: LevyPaymentsService) {}

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
  @ApiOperation({ summary: 'Get all schools for dropdown' })
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
        },
      },
    },
  })
  async getAllSchools() {
    return await this.levyPaymentsService.getAllSchools();
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
