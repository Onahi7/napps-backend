import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { LevyPayment, LevyPaymentDocument } from '../schemas/levy-payment.schema';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
import { School, SchoolDocument } from '../schemas/school.schema';
import { FlutterwaveService } from '../common/services/flutterwave.service';
import { EmailService } from '../common/services/email.service';
import {
  InitializeLevyPaymentDto,
  VerifyLevyPaymentDto,
  CheckDuplicateDto,
  LevyPaymentQueryDto,
} from '../dto/levy-payment.dto';

@Injectable()
export class LevyPaymentsService {
  private readonly logger = new Logger(LevyPaymentsService.name);
  private readonly LEVY_AMOUNT_NAIRA = 5500;
  private readonly LEVY_AMOUNT_KOBO = this.LEVY_AMOUNT_NAIRA * 100;

  constructor(
    private configService: ConfigService,
    private flutterwaveService: FlutterwaveService,
    private emailService: EmailService,
    @InjectModel(LevyPayment.name) private levyPaymentModel: Model<LevyPaymentDocument>,
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
  ) {}

  /**
   * Check for duplicate email or phone
   */
  async checkDuplicate(checkDuplicateDto: CheckDuplicateDto): Promise<{
    isDuplicate: boolean;
    payment?: LevyPaymentDocument;
    canContinue?: boolean;
  }> {
    try {
      const { email, phone } = checkDuplicateDto;

      if (!email && !phone) {
        throw new BadRequestException('Either email or phone must be provided');
      }

      const query: FilterQuery<LevyPaymentDocument> = { isActive: true };
      
      if (email && phone) {
        query.$or = [{ email }, { phone }];
      } else if (email) {
        query.email = email;
      } else if (phone) {
        query.phone = phone;
      }

      const existingPayment = await this.levyPaymentModel
        .findOne(query)
        .sort({ createdAt: -1 });

      if (existingPayment) {
        const canContinue = existingPayment.status !== 'success';
        
        return {
          isDuplicate: true,
          payment: existingPayment,
          canContinue,
        };
      }

      return {
        isDuplicate: false,
      };
    } catch (error: any) {
      this.logger.error(`Check duplicate failed: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Get all schools for dropdown
   */
  async getAllSchools(chapter?: string): Promise<Array<{ id: string; name: string; lga?: string; chapter?: string }>> {
    try {
      const filter: any = { isActive: true };
      
      // Filter by chapter if provided
      if (chapter) {
        filter.chapter = chapter;
      }

      const schools = await this.schoolModel
        .find(filter)
        .select('schoolName lga chapter')
        .sort({ schoolName: 1 })
        .lean();

      return schools.map((school) => ({
        id: school._id.toString(),
        name: school.schoolName,
        lga: school.lga,
        chapter: school.chapter,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get schools: ${error?.message || error}`);
      return [];
    }
  }

  /**
   * Initialize a levy payment
   */
  async initializePayment(
    initializeLevyPaymentDto: InitializeLevyPaymentDto
  ): Promise<{
    reference: string;
    paymentUrl: string;
    amount: number;
    receiptNumber: string;
  }> {
    try {
      this.logger.log(`Initializing levy payment for: ${initializeLevyPaymentDto.email}`);

      // Try to find proprietor by ID, email, or phone
      let proprietor = null;
      let proprietorId = null;

      if (initializeLevyPaymentDto.proprietorId) {
        // If proprietorId provided, use it
        proprietor = await this.proprietorModel.findById(
          initializeLevyPaymentDto.proprietorId
        );
        if (proprietor) {
          proprietorId = proprietor._id;
          this.logger.log(`Linked to proprietor by ID: ${proprietorId}`);
        }
      } else {
        // Try to find by email or phone
        const query = {
          $or: [
            { email: initializeLevyPaymentDto.email },
            { phone: initializeLevyPaymentDto.phone },
          ],
        };
        proprietor = await this.proprietorModel.findOne(query);
        if (proprietor) {
          proprietorId = proprietor._id;
          this.logger.log(`Auto-linked to proprietor by email/phone: ${proprietorId}`);
        } else {
          this.logger.log('No matching proprietor found - recording as public payment');
        }
      }

      // Check for duplicates
      const duplicateCheck = await this.checkDuplicate({
        email: initializeLevyPaymentDto.email,
        phone: initializeLevyPaymentDto.phone,
      });

      if (duplicateCheck.isDuplicate && !initializeLevyPaymentDto.isContinuation) {
        if (duplicateCheck.payment?.status === 'success') {
          throw new ConflictException(
            'Payment already completed with this email/phone. Please use a different email or phone number.'
          );
        } else {
          throw new ConflictException(
            'A payment is already in progress with this email/phone. You can continue with the existing payment.'
          );
        }
      }

      // Generate unique reference
      const reference = this.generatePaymentReference();
      const receiptNumber = this.generateReceiptNumber();
      
      // Use custom amount or default
      const amount = initializeLevyPaymentDto.amount 
        ? initializeLevyPaymentDto.amount * 100 
        : this.LEVY_AMOUNT_KOBO;

      // Create payment record (with or without proprietor link)
      const levyPayment = new this.levyPaymentModel({
        proprietorId: proprietorId || undefined, // Only set if found
        memberName: initializeLevyPaymentDto.memberName,
        email: initializeLevyPaymentDto.email,
        phone: initializeLevyPaymentDto.phone,
        chapter: initializeLevyPaymentDto.chapter,
        schoolName: initializeLevyPaymentDto.schoolName,
        isManualSchoolEntry: initializeLevyPaymentDto.isManualSchoolEntry || false,
        wards: initializeLevyPaymentDto.wards,
        amount,
        reference,
        receiptNumber,
        status: 'pending',
        isContinuation: initializeLevyPaymentDto.isContinuation || false,
        previousPaymentReference: initializeLevyPaymentDto.previousPaymentReference,
        metadata: initializeLevyPaymentDto.metadata || {},
      });

      await levyPayment.save();

      // Initialize Flutterwave payment
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:8080';
      const callbackUrl = initializeLevyPaymentDto.callbackUrl || 
        `${frontendUrl}/levy-payment/verify?reference=${reference}`;

      const flutterwaveResponse = await this.flutterwaveService.initializePayment({
        tx_ref: reference,
        amount: amount / 100, // Convert kobo to Naira
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: initializeLevyPaymentDto.email,
          phonenumber: initializeLevyPaymentDto.phone,
          name: initializeLevyPaymentDto.memberName,
        },
        customizations: {
          title: 'NAPPS Levy Payment',
          description: `Levy payment for ${initializeLevyPaymentDto.chapter} chapter`,
          logo: `${frontendUrl}/napps-logo.png`,
        },
        meta: {
          proprietorId: proprietorId?.toString() || 'none',
          chapter: initializeLevyPaymentDto.chapter,
          schoolName: initializeLevyPaymentDto.schoolName,
          wards: initializeLevyPaymentDto.wards.join(', '),
        },
      });

      // Update payment with Flutterwave details
      await levyPayment.updateOne({
        paymentUrl: flutterwaveResponse.link,
        status: 'processing',
      });

      this.logger.log(`Levy payment initialized successfully: ${reference}`);

      return {
        reference,
        paymentUrl: flutterwaveResponse.link,
        amount: amount / 100,
        receiptNumber,
      };
    } catch (error: any) {
      this.logger.error(`Levy payment initialization failed: ${error?.message || error}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to initialize levy payment');
    }
  }

  /**
   * Verify a levy payment
   */
  async verifyPayment(
    verifyLevyPaymentDto: VerifyLevyPaymentDto
  ): Promise<LevyPaymentDocument> {
    try {
      this.logger.log(`Verifying levy payment: ${verifyLevyPaymentDto.reference}`);

      // Find payment in database
      const payment = await this.levyPaymentModel
        .findOne({ reference: verifyLevyPaymentDto.reference })
        .populate('proprietorId', 'firstName lastName email');

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // If already successful, return it
      if (payment.status === 'success') {
        this.logger.log(`Payment ${verifyLevyPaymentDto.reference} already verified`);
        return payment;
      }

      // Verify with Flutterwave
      const verificationResponse = await this.flutterwaveService.verifyPayment(
        verifyLevyPaymentDto.reference
      );

      const transactionData = verificationResponse.data;

      // Update payment based on verification
      const updateData: any = {
        flutterwaveTransactionId: transactionData.id.toString(),
        flutterwavePaymentId: transactionData.flw_ref,
        gatewayResponse: transactionData.processor_response,
        paymentMethod: transactionData.payment_type,
      };

      if (transactionData.status === 'successful') {
        updateData.status = 'success';
        updateData.paidAt = new Date(transactionData.created_at);
        
        // Try to link to proprietor if not already linked
        if (!payment.proprietorId) {
          this.logger.log('Payment not linked to proprietor - attempting auto-link');
          const query = {
            $or: [
              { email: payment.email },
              { phone: payment.phone },
            ],
          };
          const proprietor = await this.proprietorModel.findOne(query);
          if (proprietor) {
            updateData.proprietorId = proprietor._id;
            this.logger.log(`Auto-linked payment to proprietor: ${proprietor._id}`);
            
            // Update proprietor's payment status
            try {
              await this.proprietorModel.updateOne(
                { _id: proprietor._id },
                { 
                  paymentStatus: 'paid',
                  $set: {
                    'metadata.levyPaymentReference': payment.reference,
                    'metadata.levyPaymentDate': new Date(),
                  }
                }
              );
              this.logger.log(`Updated proprietor payment status to 'paid'`);
            } catch (proprietorUpdateError: any) {
              this.logger.error(`Failed to update proprietor payment status: ${proprietorUpdateError?.message}`);
            }
          } else {
            this.logger.log('No matching proprietor found - recording as public payment');
          }
        } else {
          // Payment already linked - update proprietor's payment status
          try {
            await this.proprietorModel.updateOne(
              { _id: payment.proprietorId },
              { 
                paymentStatus: 'paid',
                $set: {
                  'metadata.levyPaymentReference': payment.reference,
                  'metadata.levyPaymentDate': new Date(),
                }
              }
            );
            this.logger.log(`Updated linked proprietor payment status to 'paid'`);
          } catch (proprietorUpdateError: any) {
            this.logger.error(`Failed to update proprietor payment status: ${proprietorUpdateError?.message}`);
          }
        }
      } else if (transactionData.status === 'failed') {
        updateData.status = 'failed';
        updateData.failureReason = transactionData.processor_response;
      }

      await payment.updateOne(updateData);

      const updatedPayment = await this.levyPaymentModel
        .findById(payment._id)
        .populate('proprietorId', 'firstName lastName email');

      // Send confirmation email if successful
      if (transactionData.status === 'successful') {
        try {
          await this.sendPaymentConfirmation(updatedPayment!);
        } catch (emailError: any) {
          this.logger.error(`Failed to send confirmation email: ${emailError?.message || emailError}`);
          // Don't fail the payment if email fails
        }
      }

      this.logger.log(`Levy payment verified: ${verifyLevyPaymentDto.reference} - ${updateData.status}`);

      return updatedPayment!;
    } catch (error: any) {
      this.logger.error(`Levy payment verification failed: ${error?.message || error}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to verify levy payment');
    }
  }

  /**
   * Get all levy payments with filters
   */
  async findAllPayments(query: LevyPaymentQueryDto): Promise<{
    data: LevyPaymentDocument[];
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
      chapter,
      status,
      email,
      phone,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: FilterQuery<LevyPaymentDocument> = { isActive: true };

    if (proprietorId) filter.proprietorId = proprietorId;
    if (chapter) filter.chapter = chapter;
    if (status) filter.status = status;
    if (email) filter.email = email;
    if (phone) filter.phone = phone;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sort: { [key: string]: SortOrder } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.levyPaymentModel
        .find(filter)
        .populate('proprietorId', 'firstName lastName email phone')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.levyPaymentModel.countDocuments(filter),
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

  /**
   * Get payment by reference
   */
  async findByReference(reference: string): Promise<LevyPaymentDocument> {
    const payment = await this.levyPaymentModel
      .findOne({ reference })
      .populate('proprietorId', 'firstName lastName email phone');

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${reference} not found`);
    }

    return payment;
  }

  /**
   * Get payment by email or phone (for receipt download)
   */
  async findByIdentifier(identifier: string): Promise<LevyPaymentDocument[]> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(identifier);

    const payments = await this.levyPaymentModel
      .find({
        [isEmail ? 'email' : 'phone']: identifier,
        status: 'success',
        isActive: true,
      })
      .populate('proprietorId', 'firstName lastName email phone')
      .sort({ paidAt: -1 });

    if (!payments || payments.length === 0) {
      throw new NotFoundException('No successful payments found for this identifier');
    }

    return payments;
  }

  /**
   * Get payment statistics
   */
  async getStats(startDate?: string, endDate?: string): Promise<any> {
    const filter: FilterQuery<LevyPaymentDocument> = { isActive: true };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [totalStats, chapterStats, statusStats] = await Promise.all([
      this.levyPaymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
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
      this.levyPaymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$chapter',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      this.levyPaymentModel.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
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
      paymentsByChapter: chapterStats.reduce((acc, item) => {
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
    };
  }

  /**
   * Send payment confirmation email
   */
  private async sendPaymentConfirmation(payment: LevyPaymentDocument): Promise<void> {
    const proprietor = payment.proprietorId as any;
    
    await this.emailService.sendPaymentConfirmationEmail(
      payment.email,
      {
        proprietorName: payment.memberName,
        amount: payment.amount,
        reference: payment.reference,
        paymentType: 'NAPPS Levy Payment',
      }
    );
  }

  /**
   * Generate unique payment reference
   */
  private generatePaymentReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `LEVY_${timestamp}_${random}`;
  }

  /**
   * Generate receipt number
   */
  private generateReceiptNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `NAPPS-${year}-${random.toString().padStart(4, '0')}`;
  }
}
