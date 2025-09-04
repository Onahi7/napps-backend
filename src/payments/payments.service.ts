import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
import { School, SchoolDocument } from '../schemas/school.schema';
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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackClient: AxiosInstance;
  private readonly paystackSecretKey: string;
  private readonly paystackWebhookSecret: string;

  constructor(
    private configService: ConfigService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
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

      // Generate unique reference
      const reference = this.generatePaymentReference();
      
      // Convert amount to kobo (Paystack format)
      const amountInKobo = Math.round(initializePaymentDto.amount * 100);

      // Create payment record
      const paymentData = {
        ...initializePaymentDto,
        reference,
        amount: amountInKobo,
        status: 'pending',
      };

      const payment = new this.paymentModel(paymentData);
      await payment.save();

      // Prepare Paystack payload
      const paystackPayload = {
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

      // Add split configuration if provided
      if (initializePaymentDto.splitConfig && initializePaymentDto.splitConfig.length > 0) {
        (paystackPayload as any).split = {
          type: 'flat',
          bearer_type: 'account',
          subaccounts: initializePaymentDto.splitConfig.map(split => ({
            subaccount: split.subaccount,
            share: split.share,
          })),
        };
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

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto): Promise<PaymentDocument> {
    try {
      // Find payment in database
      const payment = await this.paymentModel.findOne({ 
        reference: verifyPaymentDto.reference 
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Verify with Paystack
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
          .populate('proprietorId', 'firstName lastName email phone')
          .populate('schoolId', 'schoolName');
          
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
    return await this.paymentModel
      .find({ proprietorId, isActive: true })
      .populate('schoolId', 'schoolName')
      .sort({ createdAt: -1 });
  }

  async getPaymentsBySchool(schoolId: string): Promise<PaymentDocument[]> {
    return await this.paymentModel
      .find({ schoolId, isActive: true })
      .populate('proprietorId', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }
}