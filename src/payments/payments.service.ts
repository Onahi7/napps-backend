import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
import { School, SchoolDocument } from '../schemas/school.schema';
import { FeeConfiguration, FeeConfigurationDocument } from '../schemas/fee-configuration.schema';
import { EmailService } from '../common/services/email.service';
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

interface FeeStructure {
  platformFeePercentage?: number;
  platformFeeFixed?: number;
  processingFeePercentage?: number;
  processingFeeCap?: number;
  nappsSharePercentage?: number;
  nappsShareFixed?: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackClient: AxiosInstance;
  private readonly paystackSecretKey: string;
  private readonly paystackWebhookSecret: string;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(FeeConfiguration.name) private feeConfigurationModel: Model<FeeConfigurationDocument>,
  ) {
    this.paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.paystackWebhookSecret = this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET') || '';

    if (!this.paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is required');
    }

    this.paystackClient = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // =============== PAYMENT INITIALIZATION ===============

  async initializePayment(initializePaymentDto: InitializePaymentDto): Promise<PaymentResponseDto> {
    try {
      // Verify proprietor exists
      const proprietor = await this.proprietorModel.findById(initializePaymentDto.proprietorId);
      if (!proprietor) {
        throw new NotFoundException('Proprietor not found');
      }

      // Verify school exists (if provided)
      if (initializePaymentDto.schoolId) {
        const school = await this.schoolModel.findById(initializePaymentDto.schoolId);
        if (!school) {
          throw new NotFoundException('School not found');
        }
      }

      // Get fee configuration to calculate fees
      let feeBreakdown = initializePaymentDto.feeBreakdown || {
        platformFee: 0,
        processingFee: 0,
        nappsShare: 0,
        proprietorShare: 0,
      };

      let splitCode = initializePaymentDto.splitCode || undefined;
      let baseAmount = initializePaymentDto.amount;

      try {
        const feeConfig = await this.feeConfigurationModel.findOne({
          code: initializePaymentDto.paymentType,
          isActive: true,
        });

        if (feeConfig) {
          const amountInKobo = Math.round(baseAmount * 100);
          const feeStructure = (feeConfig.feeStructure || {}) as FeeStructure;

          // Calculate fees based on configuration
          feeBreakdown = {
            platformFee: (feeStructure.platformFeeFixed || 0) +
              Math.round((amountInKobo * (feeStructure.platformFeePercentage || 0)) / 100),
            processingFee: Math.min(
              Math.round((amountInKobo * (feeStructure.processingFeePercentage || 1.5)) / 100),
              feeStructure.processingFeeCap || 200000
            ),
            nappsShare: (feeStructure.nappsShareFixed || 0) +
              Math.round((amountInKobo * (feeStructure.nappsSharePercentage || 0)) / 100),
            proprietorShare: amountInKobo,
          };

          // Use configured split code if available
          if (feeConfig.paystackSplitCode) {
            splitCode = feeConfig.paystackSplitCode;
          }

          // Update amount if configured amount is different
          if (!initializePaymentDto.amount || initializePaymentDto.amount === 0) {
            baseAmount = feeConfig.amount;
          }
        }
      } catch (error) {
        this.logger.warn(`Fee configuration not found for ${initializePaymentDto.paymentType}, using default fees`);
      }

      // Generate unique reference
      const reference = this.generatePaymentReference();
      
      // Convert amount to kobo (Paystack format)
      const amountInKobo = Math.round(baseAmount * 100);

      // Create payment record
      const paymentData = {
        ...initializePaymentDto,
        reference,
        amount: amountInKobo,
        status: 'pending',
        feeBreakdown,
        paystackSplitCode: splitCode,
      };

      const payment = new this.paymentModel(paymentData);
      await payment.save();

      // Prepare Paystack payload
      const paystackPayload: any = {
        email: initializePaymentDto.email,
        amount: amountInKobo,
        reference,
        currency: 'NGN',
        callback_url: initializePaymentDto.callbackUrl,
        metadata: {
          proprietorId: initializePaymentDto.proprietorId,
          schoolId: initializePaymentDto.schoolId,
          paymentType: initializePaymentDto.paymentType,
          description: initializePaymentDto.description,
          custom_fields: [
            {
              display_name: 'Proprietor',
              variable_name: 'proprietor',
              value: `${proprietor.firstName} ${proprietor.lastName}`,
            },
            {
              display_name: 'Payment Type',
              variable_name: 'payment_type',
              value: initializePaymentDto.paymentType,
            },
          ],
          ...initializePaymentDto.metadata,
        },
      };

      // Add split code if configured
      if (splitCode) {
        paystackPayload.split_code = splitCode;
        this.logger.log(`Using Paystack split code: ${splitCode} for payment ${reference}`);
      }

      // Initialize payment with Paystack
      const response = await this.paystackClient.post('/transaction/initialize', paystackPayload);

      if (response.data.status) {
        // Update payment with Paystack transaction details
        await payment.updateOne({
          paystackTransactionId: response.data.data.reference,
        });

        return {
          id: payment._id?.toString() || '',
          reference: payment.reference,
          authorizationUrl: response.data.data.authorization_url,
          amount: payment.amount,
          status: payment.status,
          paymentType: payment.paymentType,
          createdAt: payment.createdAt,
        };
      } else {
        throw new BadRequestException('Failed to initialize payment with Paystack');
      }
    } catch (error) {
      this.logger.error(`Payment initialization failed: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to initialize payment');
    }
  }

  // =============== PAYMENT VERIFICATION ===============

  async simulatePayment(reference: string): Promise<{ message: string; payment: any }> {
    try {
      this.logger.log(`🎭 Starting payment simulation for reference: ${reference}`);
      
      // Find payment in database
      const payment = await this.paymentModel.findOne({ reference });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === 'success') {
        this.logger.log(`Payment ${reference} already successful`);
        return {
          message: 'Payment already completed',
          payment: {
            reference: payment.reference,
            status: payment.status,
            amount: payment.amount / 100,
            paidAt: payment.paidAt,
          },
        };
      }

      // Simulate successful payment
      const now = new Date();
      const simulatedTransactionId = `SIM_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

      await payment.updateOne({
        status: 'success',
        paystackTransactionId: simulatedTransactionId,
        paystackChannel: 'simulated_card',
        gatewayResponse: 'Simulated payment successful',
        paidAt: now,
        metadata: {
          ...payment.metadata,
          simulated: true,
          simulatedAt: now.toISOString(),
        },
      });

      // Update proprietor's payment status
      if (payment.proprietorId) {
        await this.proprietorModel.findByIdAndUpdate(payment.proprietorId, {
          clearingStatus: 'cleared',
          totalAmountDue: 0,
          paymentStatus: 'paid',
          lastPaymentDate: now,
        });
        this.logger.log(`✅ Proprietor ${payment.proprietorId} marked as cleared via simulation`);
      }

      const updatedPayment = await this.paymentModel.findById(payment._id)
        .populate('proprietorId', 'firstName middleName lastName email phone')
        .populate('schoolId', 'schoolName');

      this.logger.log(`🎉 Payment simulation completed successfully for ${reference}`);

      // Send payment confirmation email
      if (updatedPayment && updatedPayment.proprietorId) {
        const proprietor = updatedPayment.proprietorId as any;
        const fullName = `${proprietor.firstName} ${proprietor.middleName || ''} ${proprietor.lastName}`.trim();
        
        // Validate email or use fallback
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipientEmail = emailRegex.test(proprietor.email) 
          ? proprietor.email 
          : 'dicksonhardy7@gmail.com';
        
        if (recipientEmail === 'dicksonhardy7@gmail.com') {
          this.logger.warn(`Invalid email for ${fullName}, using fallback: dicksonhardy7@gmail.com`);
        }

        try {
          await this.emailService.sendPaymentConfirmationEmail(
            recipientEmail,
            {
              proprietorName: fullName,
              amount: updatedPayment.amount,
              reference: updatedPayment.reference,
              paymentType: '2025/2026 NAPPS NASARAWA DUES',
            }
          );
          this.logger.log(`📧 Payment confirmation email sent to ${recipientEmail}`);
        } catch (emailError) {
          this.logger.error(`Failed to send email: ${emailError.message}`);
          // Don't fail the payment if email fails
        }
      }

      return {
        message: 'Payment simulated successfully',
        payment: {
          reference: updatedPayment!.reference,
          status: updatedPayment!.status,
          amount: updatedPayment!.amount / 100,
          paidAt: updatedPayment!.paidAt,
          transactionId: simulatedTransactionId,
          simulated: true,
        },
      };
    } catch (error) {
      this.logger.error(`Payment simulation failed: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Payment simulation failed');
    }
  }

  async initiateLookupPayment(
    submissionId: string, 
    email: string
  ): Promise<{ simulationMode?: boolean; paymentUrl?: string; payment?: any }> {
    try {
      this.logger.log(`💳 Initiating lookup payment for submission: ${submissionId}`);
      
      // Find proprietor by submissionId (UUID string) or MongoDB _id
      let proprietor = await this.proprietorModel.findOne({
        submissionId
      }).populate('school');

      // If not found by submissionId, try searching by MongoDB _id
      if (!proprietor && submissionId.match(/^[0-9a-fA-F]{24}$/)) {
        // submissionId looks like a MongoDB ObjectId, try finding by _id
        proprietor = await this.proprietorModel.findById(submissionId).populate('school');
      }

      if (!proprietor) {
        throw new NotFoundException('Proprietor not found');
      }

      // Check if already cleared
      if (proprietor.clearingStatus === 'cleared') {
        throw new BadRequestException('Payment already cleared for this proprietor');
      }

      // Try to find the school for this proprietor if not already linked
      let schoolId = proprietor.school;
      if (!schoolId) {
        const school = await this.schoolModel.findOne({ proprietorId: proprietor._id });
        if (school) {
          schoolId = school._id as any;
          // Update the proprietor with the school reference for future use
          try {
            await this.proprietorModel.findByIdAndUpdate(proprietor._id, { school: school._id });
          } catch (error) {
            this.logger.warn(`Failed to update proprietor ${proprietor._id} with school reference: ${error.message}`);
          }
        }
      }

      // Get all active fees
      const fees = await this.feeConfigurationModel.find({ isActive: true }).lean();
      const baseTotalAmount = fees.reduce((sum: number, fee: any) => sum + fee.amount, 0);
      
      // Use saved amount or calculate total
      const totalAmount = proprietor.totalAmountDue && proprietor.totalAmountDue > 0
        ? proprietor.totalAmountDue
        : baseTotalAmount;

      // Generate payment reference
      const reference = `PAY_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      // Get split code
      const primaryFee = fees.find((f: any) => f.paystackSplitCode);
      const splitCode = primaryFee?.paystackSplitCode;

      // Create payment record
      const paymentData = {
        proprietorId: proprietor._id,
        schoolId: schoolId,
        amount: Math.round(totalAmount * 100), // Convert to kobo
        paymentType: 'registration_fee',
        reference,
        status: 'pending',
        email: proprietor.email,
        paystackSplitCode: splitCode,
        description: `Payment from lookup for ${proprietor.firstName} ${proprietor.lastName}`,
        metadata: {
          submissionId: proprietor.submissionId,
          fees: fees.map((f: any) => ({ code: f.code, name: f.name, amount: f.amount })),
          lookupPayment: true,
        },
      };

      const payment = new this.paymentModel(paymentData);
      await payment.save();

      // Check if we're in simulation mode
      const paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      const isSimulationMode = !paystackSecretKey || paystackSecretKey === 'simulation';
      
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:8080';

      if (isSimulationMode) {
        this.logger.log(`🎭 Simulation mode enabled for ${email}`);
        return {
          simulationMode: true,
          paymentUrl: `${frontendUrl}/payment/simulate?reference=${reference}`,
          payment: {
            reference,
            amount: totalAmount,
          },
        };
      }

      // Initialize real Paystack payment
      const paystackPayload: any = {
        email: proprietor.email,
        amount: Math.round(totalAmount * 100), // Convert to kobo
        reference,
        callback_url: `${frontendUrl}/payment/verify?reference=${reference}`,
        metadata: {
          proprietorId: String(proprietor._id),
          schoolId: schoolId?.toString() || '',
          submissionId: proprietor.submissionId,
          lookupPayment: true,
        },
      };

      if (splitCode) {
        paystackPayload.split_code = splitCode;
      }

      const paystackResponse = await this.paystackClient.post('/transaction/initialize', paystackPayload);

      if (paystackResponse && paystackResponse.data) {
        this.logger.log(`✅ Paystack payment initialized for ${email}`);
        return {
          paymentUrl: paystackResponse.data.authorization_url,
          payment: {
            reference,
            amount: totalAmount,
          },
        };
      }

      throw new BadRequestException('Failed to initialize payment with Paystack');
    } catch (error) {
      this.logger.error(`Failed to initiate lookup payment: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to initiate payment');
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto): Promise<PaymentDocument> {
    try {
      // Find payment in database
      const payment = await this.paymentModel.findOne({ 
        reference: verifyPaymentDto.reference 
      }).populate('proprietorId', 'firstName middleName lastName email phone')
        .populate('schoolId', 'schoolName lga');

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Check if payment is from simulation
      const isSimulatedPayment = payment.reference.startsWith('SIM_') || payment.status === 'success';
      
      // If payment already successful or simulated, just return it
      if (isSimulatedPayment && payment.status === 'success') {
        return payment;
      }

      // Verify with Paystack only if not simulated
      const response = await this.paystackClient.get(`/transaction/verify/${verifyPaymentDto.reference}`);

      if (response.data.status && response.data.data) {
        const transactionData = response.data.data;

        // Update payment with verification data
        await payment.updateOne({
          status: transactionData.status === 'success' ? 'success' : 'failed',
          paystackTransactionId: transactionData.id,
          paystackAuthorizationCode: transactionData.authorization?.authorization_code,
          paystackCardType: transactionData.authorization?.card_type,
          paystackBank: transactionData.authorization?.bank,
          paystackChannel: transactionData.channel,
          gatewayResponse: transactionData.gateway_response,
          paidAt: transactionData.status === 'success' ? new Date(transactionData.paid_at) : undefined,
          failureReason: transactionData.status !== 'success' ? transactionData.gateway_response : undefined,
        });

        const updatedPayment = await this.paymentModel.findById(payment._id)
          .populate('proprietorId', 'firstName middleName lastName email phone')
          .populate('schoolId', 'schoolName lga');
          
        return updatedPayment!;
      } else {
        throw new BadRequestException('Payment verification failed');
      }
    } catch (error) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Payment verification failed');
    }
  }

  // =============== WEBHOOK HANDLING ===============

  async handleWebhook(webhookDto: WebhookDto, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(JSON.stringify(webhookDto), signature)) {
        throw new BadRequestException('Invalid webhook signature');
      }

      const { event, data } = webhookDto;

      switch (event) {
        case 'charge.success':
          await this.handleChargeSuccess(data);
          break;
        case 'charge.failed':
          await this.handleChargeFailed(data);
          break;
        case 'transfer.success':
          await this.handleTransferSuccess(data);
          break;
        case 'transfer.failed':
          await this.handleTransferFailed(data);
          break;
        default:
          this.logger.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      this.logger.error(`Webhook handling failed: ${error.message}`);
      throw error;
    }
  }

  private async handleChargeSuccess(data: any): Promise<void> {
    const payment = await this.paymentModel.findOne({ reference: data.reference });
    if (payment) {
      await payment.updateOne({
        status: 'success',
        paidAt: new Date(data.paid_at),
        paystackTransactionId: data.id,
        webhookReceived: true,
        webhookData: data,
      });
      this.logger.log(`Payment ${data.reference} marked as successful via webhook`);
    }
  }

  private async handleChargeFailed(data: any): Promise<void> {
    const payment = await this.paymentModel.findOne({ reference: data.reference });
    if (payment) {
      await payment.updateOne({
        status: 'failed',
        failureReason: data.gateway_response,
        webhookReceived: true,
        webhookData: data,
      });
      this.logger.log(`Payment ${data.reference} marked as failed via webhook`);
    }
  }

  private async handleTransferSuccess(data: any): Promise<void> {
    this.logger.log(`Transfer ${data.reference} completed successfully`);
  }

  private async handleTransferFailed(data: any): Promise<void> {
    this.logger.error(`Transfer ${data.reference} failed: ${data.failure_reason}`);
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.paystackWebhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    const hash = crypto
      .createHmac('sha512', this.paystackWebhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  // =============== PAYMENT MANAGEMENT ===============

  async findAllPayments(query: PaymentQueryDto): Promise<{
    data: PaymentDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      proprietorId,
      schoolId,
      status,
      paymentType,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build filter query
    const filter: FilterQuery<PaymentDocument> = { isActive: true };

    if (proprietorId) filter.proprietorId = proprietorId;
    if (schoolId) filter.schoolId = schoolId;
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (minAmount !== undefined) {
      filter.amount = { ...filter.amount, $gte: minAmount };
    }
    if (maxAmount !== undefined) {
      filter.amount = { ...filter.amount, $lte: maxAmount };
    }

    // Build sort object
    const sort: { [key: string]: SortOrder } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('proprietorId', 'firstName lastName email phone registrationNumber')
        .populate('schoolId', 'schoolName address')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(filter),
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

  async findPaymentById(id: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel
      .findById(id)
      .populate('proprietorId', 'firstName lastName email phone registrationNumber')
      .populate('schoolId', 'schoolName address');

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // If payment has no school info but has proprietor, try to find school by proprietorId
    if (!payment.schoolId && payment.proprietorId) {
      try {
        const school = await this.schoolModel.findOne({ 
          proprietorId: payment.proprietorId._id 
        }).select('schoolName address');
        
        if (school) {
          // Temporarily attach school info for this response
          (payment as any).schoolId = school;
        }
      } catch (error) {
        this.logger.warn(`Failed to lookup school for proprietor ${payment.proprietorId._id}: ${error.message}`);
      }
    }

    return payment;
  }

  async updatePayment(id: string, updatePaymentDto: UpdatePaymentDto): Promise<PaymentDocument> {
    try {
      const payment = await this.paymentModel.findByIdAndUpdate(
        id,
        updatePaymentDto,
        { new: true, runValidators: true }
      )
      .populate('proprietorId', 'firstName lastName email phone registrationNumber')
      .populate('schoolId', 'schoolName address');

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }

      return payment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update payment');
    }
  }

  // =============== REFUND MANAGEMENT ===============

  async refundPayment(id: string, refundPaymentDto: RefundPaymentDto): Promise<PaymentDocument> {
    try {
      const payment = await this.paymentModel.findById(id);
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }

      if (payment.status !== 'success') {
        throw new BadRequestException('Only successful payments can be refunded');
      }

      // Initiate refund with Paystack
      const refundPayload = {
        transaction: payment.paystackTransactionId,
        amount: refundPaymentDto.amount,
        merchant_note: refundPaymentDto.merchantNote,
      };

      const response = await this.paystackClient.post('/refund', refundPayload);

      if (response.data.status) {
        // Update payment with refund information
        await payment.updateOne({
          refundedAmount: refundPaymentDto.amount,
          refundReason: refundPaymentDto.reason,
          refundedAt: new Date(),
          status: refundPaymentDto.amount >= payment.amount ? 'refunded' : 'partially_refunded',
        });

        const updatedPayment = await this.paymentModel.findById(id)
          .populate('proprietorId', 'firstName lastName email phone registrationNumber')
          .populate('schoolId', 'schoolName address');
          
        return updatedPayment!;
      } else {
        throw new BadRequestException('Refund failed');
      }
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Refund processing failed');
    }
  }

  // =============== ANALYTICS & STATISTICS ===============

  async getPaymentStats(startDate?: string, endDate?: string): Promise<PaymentStatsDto> {
    const filter: FilterQuery<PaymentDocument> = { isActive: true };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [
      totalStats,
      statusStats,
      typeStats,
      monthlyStats,
    ] = await Promise.all([
      this.paymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            successfulPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            pendingPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            failedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.paymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$paymentType',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
        {
          $project: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.month', 10] },
                    { $concat: ['0', { $toString: '$_id.month' }] },
                    { $toString: '$_id.month' },
                  ],
                },
              ],
            },
            count: 1,
            amount: 1,
          },
        },
        { $sort: { month: 1 } },
      ]),
    ]);

    const total = totalStats[0] || {};

    return {
      totalPayments: total.totalPayments || 0,
      totalAmount: total.totalAmount || 0,
      totalAmountNaira: Math.round((total.totalAmount || 0) / 100),
      successfulPayments: total.successfulPayments || 0,
      pendingPayments: total.pendingPayments || 0,
      failedPayments: total.failedPayments || 0,
      paymentsByType: typeStats.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          amount: item.amount,
        };
        return acc;
      }, {}),
      paymentsByStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      monthlyTrends: monthlyStats,
      averageAmount: Math.round(total.avgAmount || 0),
    };
  }

  // =============== UTILITY METHODS ===============

  private generatePaymentReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `NAPPS_${timestamp}_${random}`;
  }

  async getPaymentsByProprietor(proprietorId: string): Promise<PaymentDocument[]> {
    const payments = await this.paymentModel
      .find({ proprietorId, isActive: true })
      .populate('schoolId', 'schoolName')
      .sort({ createdAt: -1 });

    // Enhance payments with school info if missing
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      if (!payment.schoolId) {
        try {
          const school = await this.schoolModel.findOne({ 
            proprietorId: payment.proprietorId 
          }).select('schoolName');
          
          if (school) {
            (payment as any).schoolId = school;
          }
        } catch (error) {
          this.logger.warn(`Failed to lookup school for proprietor ${proprietorId}: ${error.message}`);
        }
      }
      return payment;
    }));

    return enhancedPayments;
  }

  async getPaymentsBySchool(schoolId: string): Promise<PaymentDocument[]> {
    return await this.paymentModel
      .find({ schoolId, isActive: true })
      .populate('proprietorId', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }
}