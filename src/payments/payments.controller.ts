import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import {
  InitializePaymentDto,
  PaymentResponseDto,
  VerifyPaymentDto,
  WebhookDto,
  RefundPaymentDto,
  PaymentQueryDto,
  UpdatePaymentDto,
  PaymentStatsDto,
} from './dto/payment.dto';
import { PaymentDocument } from '../schemas/payment.schema';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize a new payment' })
  @ApiResponse({ status: 201, description: 'Payment initialized successfully', type: PaymentResponseDto })
  async initializePayment(@Body() initializePaymentDto: InitializePaymentDto): Promise<PaymentResponseDto> {
    return await this.paymentsService.initializePayment(initializePaymentDto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a payment transaction' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto): Promise<PaymentDocument> {
    return await this.paymentsService.verifyPayment(verifyPaymentDto);
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simulate a payment (for testing/authorized personnel)' })
  @ApiResponse({ status: 200, description: 'Payment simulated successfully' })
  async simulatePayment(
    @Body() body: { reference: string; cardNumber?: string; cardHolder?: string }
  ): Promise<{ message: string; payment: any }> {
    this.logger.log(`🎭 Simulating payment for reference: ${body.reference}`);
    return await this.paymentsService.simulatePayment(body.reference);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Paystack webhooks' })
  @ApiHeader({ name: 'x-paystack-signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() webhookDto: WebhookDto,
    @Headers('x-paystack-signature') signature: string,
  ): Promise<{ message: string }> {
    if (!signature) {
      throw new BadRequestException('Webhook signature is required');
    }
    await this.paymentsService.handleWebhook(webhookDto, signature);
    return { message: 'Webhook processed successfully' };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async findAllPayments(@Query() query: PaymentQueryDto) {
    return await this.paymentsService.findAllPayments(query);
  }

  @Get('proprietor/:proprietorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments by proprietor' })
  @ApiResponse({ status: 200, description: 'Proprietor payments retrieved successfully' })
  async getPaymentsByProprietor(@Param('proprietorId') proprietorId: string): Promise<PaymentDocument[]> {
    return await this.paymentsService.getPaymentsByProprietor(proprietorId);
  }

  @Get('school/:schoolId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments by school' })
  @ApiResponse({ status: 200, description: 'School payments retrieved successfully' })
  async getPaymentsBySchool(@Param('schoolId') schoolId: string): Promise<PaymentDocument[]> {
    return await this.paymentsService.getPaymentsBySchool(schoolId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment statistics and analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Payment statistics retrieved successfully', type: PaymentStatsDto })
  async getPaymentStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PaymentStatsDto> {
    return await this.paymentsService.getPaymentStats(startDate, endDate);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  async findPaymentById(@Param('id') id: string): Promise<PaymentDocument> {
    return await this.paymentsService.findPaymentById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment details' })
  @ApiBody({ type: UpdatePaymentDto })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  async updatePayment(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ): Promise<PaymentDocument> {
    return await this.paymentsService.updatePayment(id, updatePaymentDto);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiBody({ type: RefundPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  async refundPayment(
    @Param('id') id: string,
    @Body() refundPaymentDto: RefundPaymentDto,
  ): Promise<PaymentDocument> {
    return await this.paymentsService.refundPayment(id, refundPaymentDto);
  }

  @Get('verify/:reference')
  @ApiOperation({ summary: 'Verify payment by reference (public endpoint for callbacks)' })
  @ApiResponse({ status: 200, description: 'Payment verified and retrieved successfully' })
  async verifyPaymentByReference(@Param('reference') reference: string) {
    const verifyDto: VerifyPaymentDto = { reference };
    const payment = await this.paymentsService.verifyPayment(verifyDto);
    
    return {
      status: payment.status,
      reference: payment.reference,
      submissionId: payment.metadata?.submissionId,
      registrationNumber: payment.metadata?.registrationNumber,
      amount: payment.amount / 100, // Convert from kobo to naira
      paidAt: payment.paidAt,
      paymentType: payment.paymentType,
      proprietor: payment.proprietorId ? {
        firstName: (payment.proprietorId as any).firstName,
        middleName: (payment.proprietorId as any).middleName,
        lastName: (payment.proprietorId as any).lastName,
        email: (payment.proprietorId as any).email,
        phone: (payment.proprietorId as any).phone,
      } : null,
      school: payment.schoolId ? {
        schoolName: (payment.schoolId as any).schoolName,
        lga: (payment.schoolId as any).lga,
      } : null,
    };
  }

  @Get('reference/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by reference' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  async findPaymentByReference(@Param('reference') reference: string): Promise<PaymentDocument> {
    const verifyDto: VerifyPaymentDto = { reference };
    return await this.paymentsService.verifyPayment(verifyDto);
  }

  @Post(':id/retry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry failed payment' })
  @ApiResponse({ status: 201, description: 'Payment retry initiated successfully', type: PaymentResponseDto })
  async retryPayment(@Param('id') id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.findPaymentById(id);
    
    if (payment.status !== 'failed') {
      throw new BadRequestException('Only failed payments can be retried');
    }

    const initializeDto: InitializePaymentDto = {
      proprietorId: payment.proprietorId.toString(),
      schoolId: payment.schoolId?.toString(),
      amount: payment.amount / 100,
      paymentType: payment.paymentType,
      description: `Retry: ${payment.description}`,
      email: payment.email,
      splitCode: payment.paystackSplitCode,
      metadata: payment.metadata,
      feeBreakdown: payment.feeBreakdown,
    };

    return await this.paymentsService.initializePayment(initializeDto);
  }

  @Get('health/status')
  @ApiOperation({ summary: 'Check payment service health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'payments',
    };
  }
}