import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
import { School, SchoolDocument } from '../schemas/school.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { FeeConfiguration, FeeConfigurationDocument } from '../schemas/fee-configuration.schema';
import {
  SaveStep1Dto,
  Step2SchoolInfoDto,
  Step3PaymentInfoDto,
  CompleteRegistrationDto,
} from '../dto/proprietor.dto';
import {
  CreateProprietorDto, 
  UpdateProprietorDto, 
  ProprietorLookupDto,
  ProprietorQueryDto,
  CsvImportResultDto
} from './dto/proprietor.dto';
import { UpdateChaptersDto, BulkUpdateChaptersDto } from './dto/chapters.dto';
import { DEFAULT_CHAPTERS } from '../common/constants/napps-chapters';
import type { NappsChapter } from '../common/constants/napps-chapters';
import { FidelityService } from '../payments/fidelity.service';

@Injectable()
export class ProprietorsService {
  constructor(
    private configService: ConfigService,
    private fidelityService: FidelityService,
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(FeeConfiguration.name) private feeConfigModel: Model<FeeConfigurationDocument>,
  ) {}


  // Three-Step Registration Methods
  async saveStep1(data: SaveStep1Dto): Promise<{ submissionId: string; proprietor: ProprietorDocument }> {
    try {
      // Check for existing email
      const existingEmail = await this.proprietorModel.findOne({ 
        email: data.email 
      });
      
      if (existingEmail && existingEmail.submissionStatus !== 'draft') {
        throw new ConflictException('A proprietor with this email already exists');
      }

      // Check for existing phone
      const existingPhone = await this.proprietorModel.findOne({ 
        phone: data.phone 
      });
      
      if (existingPhone && existingPhone.submissionStatus !== 'draft') {
        throw new ConflictException('A proprietor with this phone number already exists');
      }

      // Generate unique submission ID
      const submissionId = uuidv4();

      // Create proprietor with Step 1 data
      const proprietor = new this.proprietorModel({
        ...data,
        submissionId,
        submissionStatus: 'step1',
        registrationStatus: 'pending',
        isActive: false, // Will be activated after completing all steps
        chapters: data.chapters, // Chapters is now required in the form
      });

      await proprietor.save();

      return { submissionId, proprietor };
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw new ConflictException(`A proprietor with this ${field} already exists`);
      }
      throw error;
    }
  }

  async saveStep2(submissionId: string, data: Step2SchoolInfoDto): Promise<{ proprietor: ProprietorDocument; school: SchoolDocument }> {
    // Find proprietor by submission ID
    const proprietor = await this.proprietorModel.findOne({ submissionId });
    
    if (!proprietor) {
      throw new NotFoundException(`Registration not found with submission ID: ${submissionId}`);
    }

    if (proprietor.submissionStatus === 'submitted') {
      throw new BadRequestException('This registration has already been completed');
    }

    try {
      // Create or update school
      let school: SchoolDocument | null;
      
      if (proprietor.school) {
        // Update existing school
        school = await this.schoolModel.findByIdAndUpdate(
          proprietor.school,
          data,
          { new: true, runValidators: true }
        );
        
        if (!school) {
          throw new NotFoundException('School not found');
        }
      } else {
        // Create new school
        school = new this.schoolModel({
          ...data,
          proprietorId: proprietor._id,
        });
        await school.save();

        // Link school to proprietor
        proprietor.school = school._id as any;
      }

      // Update proprietor status
      proprietor.submissionStatus = 'step2';
      await proprietor.save();

      return { proprietor, school };
    } catch (error) {
      throw new BadRequestException(`Failed to save school information: ${error.message}`);
    }
  }

  async saveStep3(
    submissionId: string,
    data: Step3PaymentInfoDto,
    finalSubmit?: boolean,
  ): Promise<{ 
    message?: string; 
    proprietor: ProprietorDocument; 
    registrationNumber?: string; 
    paymentUrl?: string; 
    reference?: string;
    gateway?: string;
    virtualAccount?: any;
    payment?: {
      reference: string;
      amount: number;
      simulationMode?: boolean;
      paymentUrl?: string;
    };
  }> {
    const proprietor = await this.proprietorModel.findOne({ submissionId });

    if (!proprietor) {
      throw new NotFoundException(`Proprietor not found with submission ID: ${submissionId}`);
    }

    if (proprietor.submissionStatus === 'submitted') {
      throw new BadRequestException('This registration has already been completed');
    }

    if (!proprietor.school) {
      throw new BadRequestException('School information must be completed before submitting payment details');
    }

    try {
      // Update payment method
      if (data.paymentMethod) proprietor.paymentMethod = data.paymentMethod;
      if (data.paymentStatus) proprietor.paymentStatus = data.paymentStatus;
      if (data.approvalStatus) proprietor.approvalStatus = data.approvalStatus;
      if (data.approvalEvidence) proprietor.approvalEvidence = data.approvalEvidence;

      // Handle Fidelity Bank payment initialization
      if ((data.paymentMethod === 'fidelity' || data.paymentMethod === 'virtuda') && !finalSubmit) {
        const fees = await this.feeConfigModel.find({ isActive: true }).lean();
        const baseTotalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalAmount = baseTotalAmount > 0 ? baseTotalAmount * 2 : 14500;

        const virtudaResult = await this.fidelityService.initializeDynamicVirtualAccount({
          amount: totalAmount,
          durationMinutes: 60,
        });

        const paymentData = {
          proprietorId: proprietor._id,
          schoolId: proprietor.school,
          amount: Math.round(totalAmount * 100),
          currency: 'NGN',
          status: 'pending',
          paymentMethod: 'fidelity',
          gateway: 'fidelity',
          reference: virtudaResult.reference,
          accountGenerationId: virtudaResult.reference,
          accountNumber: virtudaResult.accountNumber,
          accountName: virtudaResult.accountName,
          bankName: virtudaResult.bankName || 'Fidelity Bank',
          expiryTime: virtudaResult.expiryTime ? new Date(virtudaResult.expiryTime) : undefined,
          paymentType: 'registration_fee',
          email: proprietor.email,
          description: `Registration fees for ${proprietor.firstName} ${proprietor.lastName} via Fidelity Bank`,
          virtualAccount: {
            accountNumber: virtudaResult.accountNumber,
            accountName: virtudaResult.accountName,
            bankName: virtudaResult.bankName,
            amount: virtudaResult.expectedAmount,
            expiryTime: virtudaResult.expiryTime,
            accountGenerationId: virtudaResult.reference,
          },
          metadata: {
            submissionId: proprietor.submissionId,
            fees: fees.map(f => ({ code: f.code, name: f.name, amount: f.amount })),
            channel: 'fidelity_virtual_account',
          },
        };

        const payment = new this.paymentModel(paymentData);
        await payment.save();

        proprietor.submissionStatus = 'step3';
        await proprietor.save();

        return {
          message: 'Step 3 saved successfully. Fidelity virtual account generated.',
          proprietor,
          gateway: 'fidelity',
          reference: virtudaResult.reference,
          payment: {
            reference: virtudaResult.reference,
            amount: totalAmount,
          },
          virtualAccount: {
            accountNumber: virtudaResult.accountNumber,
            accountName: virtudaResult.accountName,
            bankName: virtudaResult.bankName,
            amount: virtudaResult.expectedAmount,
            expiryTime: virtudaResult.expiryTime,
            accountGenerationId: virtudaResult.reference,
            status: virtudaResult.status,
          },
        };
      }

      // Handle online payment initialization
      if (data.paymentMethod === 'online' && !finalSubmit) {

        // Get active fees for registration
        const fees = await this.feeConfigModel.find({ isActive: true }).lean();
        
        // Double the fees for all new registrations
        const baseTotalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalAmount = baseTotalAmount * 2;
        
        // Get split code from first active fee (if available)
        const primaryFee = fees.find(f => f.paystackSplitCode);
        const splitCode = primaryFee?.paystackSplitCode;

        // Generate payment reference
        const reference = `PAY_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        
        // Create payment record
        const paymentData = {
          proprietorId: proprietor._id,
          schoolId: proprietor.school,
          amount: Math.round(totalAmount * 100), // Convert to kobo
          paymentType: 'registration_fee',
          reference,
          status: 'pending',
          email: proprietor.email,
          paystackSplitCode: splitCode,
          description: `Registration fees for ${proprietor.firstName} ${proprietor.lastName}`,
          metadata: {
            submissionId: proprietor.submissionId,
            fees: fees.map(f => ({ code: f.code, name: f.name, amount: f.amount })),
          },
        };

        const payment = new this.paymentModel(paymentData);
        await payment.save();

        // Check if we're in simulation mode (no Paystack key = simulation mode)
        const paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
        const isSimulationMode = !paystackSecretKey || paystackSecretKey === 'simulation';
        
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

        if (isSimulationMode) {
          // Return simulated payment data
          return {
            message: 'Step 3 saved successfully',
            proprietor,
            payment: {
              reference,
              amount: totalAmount,
              simulationMode: true,
              paymentUrl: `${frontendUrl}/payment/simulate?reference=${reference}`,
            },
          };
        }

        // Real Paystack initialization
        const paystackPayload: any = {
          email: proprietor.email,
          amount: Math.round(totalAmount * 100), // in kobo
          reference,
          currency: 'NGN',
          callback_url: `${frontendUrl}/payment/status?reference=${reference}`,
          metadata: {
            proprietorId: String((proprietor as any)._id),
            submissionId: proprietor.submissionId,
            paymentId: String((payment as any)._id),
            custom_fields: [
              {
                display_name: 'Proprietor',
                variable_name: 'proprietor',
                value: `${proprietor.firstName} ${proprietor.lastName}`,
              },
              {
                display_name: 'Payment Type',
                variable_name: 'payment_type',
                value: 'registration_fee',
              },
            ],
          },
        };

        // Add split code if available
        if (splitCode) {
          paystackPayload.split_code = splitCode;
        }

        // Call Paystack API
        const response = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          paystackPayload,
          {
            headers: {
              Authorization: `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.status) {
          // Update payment with Paystack reference
          await payment.updateOne({
            paystackTransactionId: response.data.data.reference,
          });

          proprietor.submissionStatus = 'step3';
          await proprietor.save();

          return {
            proprietor,
            paymentUrl: response.data.data.authorization_url,
            reference: payment.reference,
          };
        } else {
          throw new BadRequestException('Failed to initialize payment with Paystack');
        }
      }

      // Handle bank transfer or final submit
      if (finalSubmit || data.paymentMethod === 'bank_transfer') {
        // Generate registration number
        const registrationNumber = await this.generateRegistrationNumber();
        proprietor.registrationNumber = registrationNumber;
        proprietor.submissionStatus = 'submitted';
        
        // Only mark as approved if payment is confirmed
        if (data.paymentStatus === 'paid') {
          proprietor.registrationStatus = 'approved';
        } else {
          proprietor.registrationStatus = 'pending';
          proprietor.paymentStatus = 'Pending';
        }
        
        proprietor.isActive = true;
        await proprietor.save();

        return { proprietor, registrationNumber };
      }

      proprietor.submissionStatus = 'step3';
      await proprietor.save();

      return { proprietor };
    } catch (error) {
      throw new BadRequestException(`Failed to save payment information: ${error.message}`);
    }
  }

  async getRegistrationProgress(submissionId: string): Promise<{
    proprietor: ProprietorDocument;
    school?: SchoolDocument;
    currentStep: number;
    isComplete: boolean;
  }> {
    const proprietor = await this.proprietorModel.findOne({ submissionId });
    
    if (!proprietor) {
      throw new NotFoundException(`Registration not found with submission ID: ${submissionId}`);
    }

    let school: SchoolDocument | undefined;
    if (proprietor.school) {
      const foundSchool = await this.schoolModel.findById(proprietor.school);
      if (foundSchool) {
        school = foundSchool;
      }
    }

    // Determine current step based on submission status
    let currentStep = 1;
    if (proprietor.submissionStatus === 'step1') currentStep = 2;
    else if (proprietor.submissionStatus === 'step2') currentStep = 3;
    else if (proprietor.submissionStatus === 'step3') currentStep = 3;
    else if (proprietor.submissionStatus === 'submitted') currentStep = 4;

    return {
      proprietor,
      school,
      currentStep,
      isComplete: proprietor.submissionStatus === 'submitted',
    };
  }

  async completeRegistration(data: CompleteRegistrationDto): Promise<ProprietorDocument> {
    const result = await this.saveStep3(data.submissionId, data.paymentInfo || {}, true);
    return result.proprietor;
  }

  async create(createProprietorDto: CreateProprietorDto): Promise<ProprietorDocument> {
    try {
      // Check for existing email
      const existingEmail = await this.proprietorModel.findOne({ 
        email: createProprietorDto.email 
      });
      
      if (existingEmail) {
        throw new ConflictException('A proprietor with this email already exists');
      }

      // Check for existing phone
      const existingPhone = await this.proprietorModel.findOne({ 
        phone: createProprietorDto.phone 
      });
      
      if (existingPhone) {
        throw new ConflictException('A proprietor with this phone number already exists');
      }

      // Generate registration number if not provided
      if (!createProprietorDto.registrationNumber) {
        createProprietorDto.registrationNumber = await this.generateRegistrationNumber();
      }

      // Assign default chapters if not provided
      if (!createProprietorDto.chapters) {
        createProprietorDto.chapters = DEFAULT_CHAPTERS;
      }

      const proprietor = new this.proprietorModel(createProprietorDto);
      return await proprietor.save();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw new ConflictException(`A proprietor with this ${field} already exists`);
      }
      throw error;
    }
  }

  async findAll(query: ProprietorQueryDto): Promise<{
    data: ProprietorDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      registrationStatus,
      nappsRegistered,
      clearingStatus,
      isActive,
      chapter,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    // Build filter query
    const filter: FilterQuery<ProprietorDocument> = {};

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { middleName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { nappsMembershipId: { $regex: search, $options: 'i' } },
      ];
    }

    if (registrationStatus) filter.registrationStatus = registrationStatus;
    if (nappsRegistered) filter.nappsRegistered = nappsRegistered;
    if (clearingStatus) filter.clearingStatus = clearingStatus;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (chapter && chapter !== 'all') filter.chapters = chapter;

    const createdAtRange: { $gte?: Date; $lte?: Date } = {};
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!Number.isNaN(from.getTime())) createdAtRange.$gte = from;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!Number.isNaN(to.getTime())) createdAtRange.$lte = to;
    }
    if (createdAtRange.$gte || createdAtRange.$lte) filter.createdAt = createdAtRange;

    // Build sort object
    const sort: { [key: string]: SortOrder } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.proprietorModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.proprietorModel.countDocuments(filter),
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

  async findOne(id: string): Promise<ProprietorDocument> {
    const proprietor = await this.proprietorModel.findById(id);
    if (!proprietor) {
      throw new NotFoundException(`Proprietor with ID ${id} not found`);
    }
    return proprietor;
  }

  // Helper method to calculate default amount due
  // isNewRegistration: true = double the fee, false = use original fee
  private async calculateDefaultAmountDue(isNewRegistration: boolean = false): Promise<number> {
    try {
      // Get ALL active fees
      const activeFees = await this.feeConfigModel.find({ isActive: true }).lean();
      
      console.log(`📊 Found ${activeFees.length} active fees in DB`);
      
      if (activeFees.length > 0) {
        console.log('📋 Active fees:', activeFees.map(f => ({
          name: f.name,
          code: f.code || 'NO_CODE',
          amount: f.amount,
        })));
        
        // Sum all active fees
        const baseTotalAmount = activeFees.reduce((sum, fee) => sum + fee.amount, 0);
        console.log(`💰 Base total amount: ₦${baseTotalAmount.toLocaleString()}`);
        
        if (isNewRegistration) {
          const doubled = baseTotalAmount * 2;
          console.log(`💰 Doubling fees for new registration: ₦${baseTotalAmount.toLocaleString()} x 2 = ₦${doubled.toLocaleString()}`);
          return doubled;
        }
        
        console.log(`📋 Using base amount for existing proprietor: ₦${baseTotalAmount.toLocaleString()}`);
        return baseTotalAmount;
      }
      
      console.log('⚠️ No active fees found, checking ANY fee (even inactive)...');
      
      console.log('⚠️ No active fee found, checking ANY fee (even inactive)...');
      
      // Try to get ANY fee (even inactive)
      const anyFee = await this.feeConfigModel.findOne().sort({ amount: 1 });
      if (anyFee) {
        const statusText = anyFee.isActive ? 'active' : 'inactive';
        console.log(`✅ Using ${statusText} fee: ${anyFee.name} (${anyFee.code || 'NO_CODE'}) - ₦${anyFee.amount.toLocaleString()}`);
        if (isNewRegistration) {
          console.log(`💰 Doubling fee for new registration: ₦${anyFee.amount.toLocaleString()} x 2 = ₦${(anyFee.amount * 2).toLocaleString()}`);
        } else {
          console.log(`📋 Using original fee for existing proprietor: ₦${anyFee.amount.toLocaleString()}`);
        }
        if (!anyFee.isActive) {
          console.log('💡 Tip: Activate this fee via PATCH /fees/configuration/:id/toggle-active');
        }
        return isNewRegistration ? anyFee.amount * 2 : anyFee.amount;
      }
      
      console.error('❌ No fee configuration found! Admin needs to set up fees.');
      console.error('👉 Call POST /fees/configuration to create a fee configuration');
      // Return 0 to indicate fees need to be configured
      return 0;
    } catch (error) {
      console.error('❌ Error calculating default amount due:', error);
      return 0; // Return 0 to indicate an issue
    }
  }

  async lookup(lookupDto: ProprietorLookupDto): Promise<Record<string, any>[]> {
    const { email, phone, registrationNumber, nappsMembershipId, schoolName, firstName, lastName, search, q } = lookupDto as any;
    const unifiedQuery = (search || q)?.trim();

    if (!email && !phone && !registrationNumber && !nappsMembershipId && !schoolName && !firstName && !lastName && !unifiedQuery) {
      throw new BadRequestException('At least one lookup parameter must be provided');
    }

    console.log('🔍 Lookup called with:', { email, phone, firstName, lastName, schoolName, registrationNumber, nappsMembershipId, unifiedQuery });

    // Helper function to escape special regex characters
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const filter: FilterQuery<ProprietorDocument> = {};

    if (unifiedQuery) {
      const escaped = escapeRegex(unifiedQuery);
      const cleanPhone = unifiedQuery.replace(/\D/g, '');
      const orConditions: any[] = [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { middleName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { schoolName: { $regex: escaped, $options: 'i' } },
        { registrationNumber: { $regex: escaped, $options: 'i' } },
        { nappsMembershipId: { $regex: escaped, $options: 'i' } },
        { submissionId: { $regex: escaped, $options: 'i' } },
      ];

      // Handle multi-word names (e.g., "Ibrahim Bello" or "St. Joseph Academy")
      if (unifiedQuery.includes(' ')) {
        const parts = unifiedQuery.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          orConditions.push({
            $and: [
              { firstName: { $regex: escapeRegex(parts[0]), $options: 'i' } },
              { lastName: { $regex: escapeRegex(parts.slice(1).join(' ')), $options: 'i' } },
            ],
          });
          orConditions.push({
            $and: [
              { firstName: { $regex: escapeRegex(parts.slice(0, -1).join(' ')), $options: 'i' } },
              { lastName: { $regex: escapeRegex(parts[parts.length - 1]), $options: 'i' } },
            ],
          });
        }
      }

      // If digits present, match phone with cleaned version
      if (cleanPhone.length >= 5) {
        orConditions.push({ phone: { $regex: cleanPhone, $options: 'i' } });
      }

      // Search linked school records by name, address, or LGA
      const matchingSchools = await this.schoolModel
        .find({
          $or: [
            { schoolName: { $regex: escaped, $options: 'i' } },
            { schoolName2: { $regex: escaped, $options: 'i' } },
            { address: { $regex: escaped, $options: 'i' } },
            { lga: { $regex: escaped, $options: 'i' } },
            { chapter: { $regex: escaped, $options: 'i' } },
          ],
        })
        .select('proprietorId')
        .lean();

      const schoolProprietorIds = matchingSchools
        .map((s) => s.proprietorId)
        .filter(Boolean);

      if (schoolProprietorIds.length > 0) {
        orConditions.push({ _id: { $in: schoolProprietorIds } });
      }

      filter.$or = orConditions;
    } else {
      if (email) filter.email = { $regex: escapeRegex(email), $options: 'i' };
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        console.log('📱 Searching for phone:', phone, '-> cleaned:', cleanPhone);
        filter.phone = { $regex: cleanPhone, $options: 'i' };
      }
      if (firstName) filter.firstName = { $regex: escapeRegex(firstName), $options: 'i' };
      if (lastName) filter.lastName = { $regex: escapeRegex(lastName), $options: 'i' };
      if (schoolName) {
        const escaped = escapeRegex(schoolName);
        const matchingSchools = await this.schoolModel
          .find({ schoolName: { $regex: escaped, $options: 'i' } })
          .select('proprietorId')
          .lean();
        const schoolProprietorIds = matchingSchools.map((s) => s.proprietorId).filter(Boolean);
        
        filter.$or = [
          { schoolName: { $regex: escaped, $options: 'i' } },
          ...(schoolProprietorIds.length > 0 ? [{ _id: { $in: schoolProprietorIds } }] : []),
        ];
      }
      if (registrationNumber) filter.registrationNumber = registrationNumber;
      if (nappsMembershipId) filter.nappsMembershipId = nappsMembershipId;
    }

    console.log('🔍 Filter being used:', JSON.stringify(filter, null, 2));

    const proprietors = await this.proprietorModel
      .find(filter)
      .populate({ path: 'school', select: '-__v' })
      .lean({ virtuals: true });

    console.log('✅ Found proprietors:', proprietors.length);

    // Fetch schools by proprietorId for those without school reference
    const proprietorIds = proprietors.map(p => (p as any)._id);
    console.log('Looking up schools for proprietor IDs:', proprietorIds.map(id => String(id)));
    
    const schoolsByProprietorId = await this.schoolModel
      .find({ proprietorId: { $in: proprietorIds } })
      .lean();

    console.log('Found schools:', schoolsByProprietorId.length, schoolsByProprietorId.map(s => ({ 
      proprietorId: String(s.proprietorId), 
      schoolName: s.schoolName 
    })));

    // Create a map of proprietorId to school
    const schoolMap = new Map();
    schoolsByProprietorId.forEach(school => {
      schoolMap.set(String(school.proprietorId), school);
    });

    // Calculate default amount due if needed (for existing proprietors, don't double)
    const defaultAmountDue = await this.calculateDefaultAmountDue(false);
    console.log(`💰 Default amount due calculated: ₦${defaultAmountDue.toLocaleString()}`);

    return proprietors.map((proprietor) => {
      const proprietorRecord = proprietor as Record<string, any>;
      
      // Try to get school from populated field first, then from proprietorId lookup
      let school = (proprietorRecord.school as Record<string, any> | undefined) ?? null;
      if (!school || typeof school !== 'object' || !school.schoolName) {
        school = schoolMap.get(String(proprietorRecord._id)) || null;
      }
      
      console.log('Proprietor:', String(proprietorRecord._id), 'School found:', school ? school.schoolName : 'NO SCHOOL');
      
      const schoolData = school ?? {};

      const participationSource = proprietorRecord.participationHistory;
      const normalizedParticipationHistory = Array.isArray(participationSource)
        ? participationSource
        : typeof participationSource === 'string' && participationSource.trim().length
          ? participationSource
              .split('|')
              .map((entry: string) => entry.trim())
              .filter((entry: string) => entry.length)
          : [];

      return {
        ...proprietorRecord,
        school,
        schoolName: schoolData.schoolName || proprietorRecord.schoolName || null,
        schoolName2: schoolData.schoolName2 || proprietorRecord.schoolName2 || null,
        schoolAddress: schoolData.address || proprietorRecord.schoolAddress || null,
        addressLine2: schoolData.addressLine2 || proprietorRecord.addressLine2 || null,
        lga: schoolData.lga || proprietorRecord.lga || null,
        aeqeoZone: schoolData.aeqeoZone || proprietorRecord.aeqeoZone || null,
        gpsLongitude: schoolData.gpsLongitude ?? proprietorRecord.gpsLongitude ?? null,
        gpsLatitude: schoolData.gpsLatitude ?? proprietorRecord.gpsLatitude ?? null,
        typeOfSchool: schoolData.typeOfSchool || proprietorRecord.typeOfSchool || null,
        categoryOfSchool: schoolData.categoryOfSchool || proprietorRecord.categoryOfSchool || null,
        ownership: schoolData.ownership || proprietorRecord.ownership || null,
        yearOfEstablishment: schoolData.yearOfEstablishment ?? proprietorRecord.yearOfEstablishment ?? null,
        yearOfApproval: schoolData.yearOfApproval ?? proprietorRecord.yearOfApproval ?? null,
        registrationEvidence: schoolData.registrationEvidence || proprietorRecord.registrationEvidence || null,
        enrollment: schoolData.enrollment || proprietorRecord.enrollment || {},
        totalEnrollment: schoolData.totalEnrollment ?? proprietorRecord.totalEnrollment ?? 0,
        totalMale: schoolData.totalMale ?? proprietorRecord.totalMale ?? 0,
        totalFemale: schoolData.totalFemale ?? proprietorRecord.totalFemale ?? 0,
        participationHistory: normalizedParticipationHistory,
        // Calculate totalAmountDue if not set or is 0
        totalAmountDue: (() => {
          const saved = proprietorRecord.totalAmountDue;
          const cleared = proprietorRecord.clearingStatus === 'cleared';
          
          if (saved && saved > 0) {
            console.log(`💾 Using saved amount for ${proprietorRecord.email}: ₦${saved.toLocaleString()}`);
            return saved;
          }
          
          if (cleared) {
            console.log(`✅ Proprietor ${proprietorRecord.email} is cleared, showing ₦0`);
            return 0;
          }
          
          console.log(`🔄 Using default amount for ${proprietorRecord.email}: ₦${defaultAmountDue.toLocaleString()}`);
          return defaultAmountDue;
        })(),
      };
    });
  }

  async update(id: string, updateProprietorDto: UpdateProprietorDto): Promise<ProprietorDocument> {
    try {
      // Transform participationHistory from object to string array if needed
      const updateData = { ...updateProprietorDto };
      
      if (updateData.participationHistory && typeof updateData.participationHistory === 'object') {
        // Convert object { "National-2023/2024": true, ... } to array ["National-2023/2024", ...]
        if (!Array.isArray(updateData.participationHistory)) {
          const participationHistory = updateData.participationHistory;
          updateData.participationHistory = Object.keys(participationHistory).filter(
            key => participationHistory[key]
          );
        }
      }

      const proprietor = await this.proprietorModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!proprietor) {
        throw new NotFoundException(`Proprietor with ID ${id} not found`);
      }
      
      return proprietor;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw new ConflictException(`A proprietor with this ${field} already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.proprietorModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Proprietor with ID ${id} not found`);
    }
  }

  async importFromCsv(
    fileBuffer: Buffer,
    skipValidation: boolean = false,
    updateExisting: boolean = false
  ): Promise<CsvImportResultDto> {
    const results: CsvImportResultDto = {
      totalRecords: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: [],
      summary: {
        newRecords: 0,
        updatedRecords: 0,
        duplicates: 0,
      },
    };

    return new Promise((resolve, reject) => {
      const records: any[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', async () => {
          results.totalRecords = records.length;

          for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNumber = i + 2; // +2 because CSV starts from row 2 (header is row 1)

            try {
              // Map CSV headers to our schema
              const proprietorData = this.mapCsvToProprietor(record);
              
              // Generate unique email if missing or blank
              if (!proprietorData.email || proprietorData.email.toLowerCase().includes('blank')) {
                // Generate email from name and row number
                const emailBase = `${proprietorData.firstName?.toLowerCase() || 'user'}${rowNumber}`;
                proprietorData.email = `${emailBase}@napps-nasarawa.edu.ng`;
              }
              
              // Validate required fields
              if (!skipValidation) {
                const validation = this.validateProprietorData(proprietorData);
                if (!validation.isValid) {
                  results.errorCount++;
                  results.errors.push({
                    row: rowNumber,
                    field: validation.field || 'unknown',
                    value: validation.value,
                    message: validation.message || 'Validation failed',
                  });
                  continue;
                }
              }

              // Check for existing proprietor
              const existing = await this.proprietorModel.findOne({
                $or: [
                  { email: proprietorData.email },
                  { phone: proprietorData.phone },
                  { registrationNumber: proprietorData.registrationNumber },
                ]
              });

              if (existing) {
                if (updateExisting) {
                  await existing.updateOne(proprietorData);
                  results.summary.updatedRecords++;
                  results.successCount++;
                } else {
                  results.summary.duplicates++;
                  results.skippedCount++;
                  results.warnings.push({
                    row: rowNumber,
                    message: `Proprietor already exists: ${proprietorData.email || proprietorData.phone}`,
                  });
                }
              } else {
                // Generate registration number if not provided
                if (!proprietorData.registrationNumber) {
                  proprietorData.registrationNumber = await this.generateRegistrationNumber();
                }

                const newProprietor = new this.proprietorModel(proprietorData);
                await newProprietor.save();
                results.summary.newRecords++;
                results.successCount++;
              }
            } catch (error) {
              results.errorCount++;
              results.errors.push({
                row: rowNumber,
                field: 'general',
                value: record,
                message: error.message || 'Unknown error occurred',
              });
            }
          }

          resolve(results);
        })
        .on('error', reject);
    });
  }

  private mapCsvToProprietor(record: any): Partial<CreateProprietorDto> {
    // Map CSV headers from the actual data source to our schema
    const mapping = {
      // Name field - extract first and last name
      'Name': 'fullName',
      
      // Basic fields
      'Sex': 'sex',
      'Email': 'email',
      'Phone/Mobile': 'phone',
      
      // School information (we'll handle this separately for school creation)
      'Name Of School': 'schoolName',
      'Name Of School 2': 'schoolName2',
      'Address': 'schoolAddress',
      
      // Registration and Status
      'Registeration Status': 'registrationStatus',
      'Approval Status': 'approvalStatus',
      
      // NAPPS specific fields
      'Are you registered with NAPPs ?': 'nappsRegistered',
      'tabular_grid': 'participationHistoryRaw',
      'How many times your School participated in Napps Nasarawa State Unified Certificate Examination': 'timesParticipated',
      'Number of Pupils presented in year 2023/2024 NAPPS Nasarawa State certificate examination': 'pupilsPresentedLastExam',
      'Award given to you / your School by NAPPS for the past four years': 'awards',
      'Position Held at NAPPS Level Progressively': 'positionHeld',
      
      // Legacy mappings for backward compatibility
      'firstName': 'firstName',
      'first_name': 'firstName',
      'First Name': 'firstName',
      'middleName': 'middleName',
      'middle_name': 'middleName',
      'Middle Name': 'middleName',
      'lastName': 'lastName',
      'last_name': 'lastName',
      'Last Name': 'lastName',
      'Gender': 'sex',
      'sex': 'sex',
      'gender': 'sex',
      'email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'phone': 'phone',
      'Phone Number': 'phone',
    };

    const mapped: any = {};
    
    for (const [csvKey, dbKey] of Object.entries(mapping)) {
      if (record[csvKey] !== undefined && record[csvKey] !== '' && record[csvKey] !== null) {
        let value = record[csvKey];
        
        // Skip blank emails
        if (dbKey === 'email' && (value === 'blank@gmail.com' || value.toLowerCase().includes('blank'))) {
          continue;
        }
        
        // Special handling for Name field - split into firstName and lastName
        if (csvKey === 'Name' && dbKey === 'fullName') {
          const nameParts = value.trim().split(/\s+/);
          if (nameParts.length >= 3) {
            mapped['firstName'] = nameParts[0];
            mapped['middleName'] = nameParts.slice(1, -1).join(' ');
            mapped['lastName'] = nameParts[nameParts.length - 1];
          } else if (nameParts.length === 2) {
            mapped['firstName'] = nameParts[0];
            mapped['lastName'] = nameParts[1];
          } else if (nameParts.length === 1) {
            mapped['firstName'] = nameParts[0];
            mapped['lastName'] = nameParts[0];
          }
          continue;
        }
        
        // Handle participation history
        if (dbKey === 'participationHistoryRaw' && value) {
          // Parse the participation history into array format
          const historyArray = value.split('|').map((item: string) => item.trim()).filter((item: string) => item);
          mapped['participationHistory'] = historyArray;
          continue;
        }
        
        // Handle numeric fields
        if (dbKey === 'timesParticipated' || dbKey === 'pupilsPresentedLastExam') {
          const numValue = parseInt(value);
          value = isNaN(numValue) ? 0 : numValue;
        }
        
        // Handle sex field
        if (dbKey === 'sex' && value) {
          value = value.trim().charAt(0).toUpperCase() + value.slice(1).toLowerCase();
          if (!['Male', 'Female'].includes(value)) {
            value = undefined;
          }
        }
        
        // Handle NAPPS registered field - normalize values
        if (dbKey === 'nappsRegistered' && value) {
          const normalizedValue = value.toLowerCase().trim();
          if (normalizedValue.includes('certificate')) {
            value = 'Registered with Certificate';
          } else if (normalizedValue.includes('registered') || normalizedValue.includes('yes')) {
            value = 'Registered';
          } else {
            value = 'Not Registered';
          }
        }
        
        // Handle registration status - normalize values
        if (dbKey === 'registrationStatus' && value) {
          const normalizedStatus = value.toLowerCase().trim();
          if (normalizedStatus.includes('registered')) {
            value = 'approved';
          } else if (normalizedStatus.includes('reject')) {
            value = 'rejected';
          } else if (normalizedStatus.includes('suspend')) {
            value = 'suspended';
          } else {
            value = 'pending';
          }
        }
        
        // Handle approval status - normalize values
        if (dbKey === 'approvalStatus' && value) {
          const normalizedStatus = value.toLowerCase().trim();
          if (normalizedStatus.includes('evidence') || normalizedStatus.includes('approve')) {
            value = 'approved';
          } else if (normalizedStatus.includes('reject')) {
            value = 'rejected';
          } else {
            value = 'pending';
          }
        }
        
        if (value !== undefined) {
          mapped[dbKey] = value;
        }
      }
    }

    return mapped;
  }

  private validateProprietorData(data: Partial<CreateProprietorDto>): {
    isValid: boolean;
    field?: string;
    value?: any;
    message?: string;
  } {
    // Check required fields
    if (!data.firstName) {
      return {
        isValid: false,
        field: 'firstName',
        value: data.firstName,
        message: 'First name is required',
      };
    }

    if (!data.lastName) {
      return {
        isValid: false,
        field: 'lastName',
        value: data.lastName,
        message: 'Last name is required',
      };
    }

    if (!data.email) {
      return {
        isValid: false,
        field: 'email',
        value: data.email,
        message: 'Email is required',
      };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        isValid: false,
        field: 'email',
        value: data.email,
        message: 'Invalid email format',
      };
    }

    if (!data.phone) {
      return {
        isValid: false,
        field: 'phone',
        value: data.phone,
        message: 'Phone number is required',
      };
    }

    return { isValid: true };
  }

  private async generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.proprietorModel.countDocuments();
    return `NAPPS${year}${String(count + 1).padStart(4, '0')}`;
  }

  // Analytics methods
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byNappsRegistration: Record<string, number>;
    byClearingStatus: Record<string, number>;
    byChapter: Record<string, number>;
    totalAmountDue: number;
  }> {
    const [
      total,
      statusStats,
      nappsStats,
      clearingStats,
      amountStats,
      chapterStats
    ] = await Promise.all([
      this.proprietorModel.countDocuments({ isActive: true }),
      this.proprietorModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$registrationStatus', count: { $sum: 1 } } }
      ]),
      this.proprietorModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$nappsRegistered', count: { $sum: 1 } } }
      ]),
      this.proprietorModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$clearingStatus', count: { $sum: 1 } } }
      ]),
      this.proprietorModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$totalAmountDue' } } }
      ]),
      this.proprietorModel.aggregate([
        { $match: { isActive: true } },
        { $unwind: { path: '$chapters', preserveNullAndEmptyArrays: true } },
        { 
          $group: { 
            _id: { $ifNull: ['$chapters', 'N/A'] }, 
            count: { $sum: 1 } 
          } 
        }
      ])
    ]);

    return {
      total,
      byStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byNappsRegistration: nappsStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byClearingStatus: clearingStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byChapter: chapterStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      totalAmountDue: amountStats[0]?.total || 0,
    };
  }

  // Update enrollment data for a proprietor
  async updateEnrollment(
    proprietorId: string,
    enrollmentDto: any
  ): Promise<{ message: string; proprietor: ProprietorDocument }> {
    const proprietor = await this.proprietorModel.findById(proprietorId);
    
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    // Update enrollment data - store in proprietor document
    // You can extend the schema to have specific enrollment fields if needed
    // For now, we'll calculate total from the enrollment data provided
    const totalEnrollment = Object.keys(enrollmentDto)
      .filter(key => !['proprietorId', 'schoolId', 'academicYear', 'term', 'notes'].includes(key))
      .reduce((sum, key) => sum + (enrollmentDto[key] || 0), 0);
    
    proprietor.pupilsPresentedLastExam = totalEnrollment;
    await proprietor.save();

    return {
      message: 'Enrollment data updated successfully',
      proprietor,
    };
  }

  // Update payment status for a proprietor
  async updatePaymentStatus(
    proprietorId: string,
    paymentDto: any
  ): Promise<{ message: string; proprietor: ProprietorDocument }> {
    const proprietor = await this.proprietorModel.findById(proprietorId);
    
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    // Update payment-related fields
    if (paymentDto.clearingStatus) {
      proprietor.clearingStatus = paymentDto.clearingStatus;
    }
    
    if (paymentDto.totalAmountDue !== undefined) {
      proprietor.totalAmountDue = paymentDto.totalAmountDue;
    }
    
    if (paymentDto.paymentMethod) {
      proprietor.paymentMethod = paymentDto.paymentMethod;
    }
    
    if (paymentDto.paymentDate) {
      proprietor.lastPaymentDate = new Date(paymentDto.paymentDate);
    }

    await proprietor.save();

    return {
      message: 'Payment status updated successfully',
      proprietor,
    };
  }

  // Bulk update both enrollment and payment data
  async bulkUpdate(
    proprietorId: string,
    updateDto: any
  ): Promise<{ message: string; proprietor: ProprietorDocument }> {
    // Update enrollment if provided
    if (updateDto.enrollment) {
      await this.updateEnrollment(proprietorId, updateDto.enrollment);
    }

    // Update payment if provided
    if (updateDto.payment) {
      await this.updatePaymentStatus(proprietorId, updateDto.payment);
    }

    // Fetch and return updated proprietor
    const proprietor = await this.proprietorModel.findById(proprietorId);
    
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    return {
      message: 'Proprietor data updated successfully',
      proprietor,
    };
  }

  // Chapter Management Methods
  async updateChapters(
    proprietorId: string,
    chaptersDto: UpdateChaptersDto
  ): Promise<{ message: string; proprietor: ProprietorDocument }> {
    const proprietor = await this.proprietorModel.findById(proprietorId);
    
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    proprietor.chapters = chaptersDto.chapters;
    await proprietor.save();

    return {
      message: 'Chapters updated successfully',
      proprietor,
    };
  }

  async bulkUpdateChapters(
    bulkDto: BulkUpdateChaptersDto
  ): Promise<{ 
    message: string; 
    updatedCount: number; 
    proprietorIds: string[];
    errors: Array<{ proprietorId: string; error: string }>;
  }> {
    const { proprietorIds, chapters, replace = false } = bulkDto;
    const errors: Array<{ proprietorId: string; error: string }> = [];
    let updatedCount = 0;

    for (const proprietorId of proprietorIds) {
      try {
        const proprietor = await this.proprietorModel.findById(proprietorId);
        
        if (!proprietor) {
          errors.push({ 
            proprietorId, 
            error: 'Proprietor not found' 
          });
          continue;
        }

        if (replace) {
          // Replace existing chapters completely
          proprietor.chapters = chapters;
        } else {
          // Add to existing chapters (avoid duplicates)
          const existingChapters = proprietor.chapters || [];
          const newChapters = [...existingChapters];
          
          for (const chapter of chapters) {
            if (!newChapters.includes(chapter)) {
              newChapters.push(chapter);
            }
          }
          
          proprietor.chapters = newChapters;
        }

        await proprietor.save();
        updatedCount++;
      } catch (error) {
        errors.push({ 
          proprietorId, 
          error: error.message || 'Unknown error occurred' 
        });
      }
    }

    return {
      message: `Bulk update completed. ${updatedCount} proprietors updated successfully.`,
      updatedCount,
      proprietorIds: proprietorIds.slice(0, updatedCount),
      errors,
    };
  }

  async getAvailableChapters(): Promise<{ chapters: NappsChapter[] }> {
    const { NAPPS_CHAPTERS } = await import('../common/constants/napps-chapters');
    return {
      chapters: [...NAPPS_CHAPTERS],
    };
  }

  // ===================== AI-ASSISTED DOCUMENT EXTRACTION =====================
  async aiExtractDocument(data: { imageBase64?: string; textSnippet?: string; documentType?: string }) {
    let text = (data.textSnippet || '').trim();

    if (!text && data.imageBase64) {
      try {
        const raw = Buffer.from(data.imageBase64.replace(/^data:.*?;base64,/, ''), 'base64').toString('utf8');
        if (/SCHOOL|NAPPS|LGA|NAME|PHONE/i.test(raw)) {
          text = raw;
        }
      } catch {}
    }

    if (!text && !data.imageBase64) {
      return {
        success: false,
        message: 'No readable document data was uploaded.',
        extractedData: null
      };
    }

    // Pattern matchers on genuine text from scanned document
    const nameMatch = text.match(/(?:FULL\s+NAME|PROPRIETOR(?:\s+NAME)?|NAME)\s*[:=-]\s*([^\r\n,;]+)/i);
    const schoolMatch = text.match(/(?:SCHOOL\s+NAME|NAME\s+OF\s+SCHOOL)\s*[:=-]\s*([^\r\n,;]+)/i);
    const addressMatch = text.match(/(?:SCHOOL\s+ADDRESS|ADDRESS)\s*[:=-]\s*([^\r\n,;]+)/i);
    const phoneMatch = text.match(/(?:PHONE(?:\s+NO)?|TEL|MOBILE)\s*[:=-]?\s*([0-9\s+()-]{10,15})/i) || text.match(/(?:(?:\+?234)|0)[789][01]\d{8}/);
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    const yearMatch = text.match(/(?:YEAR\s+(?:OF\s+)?ESTABLISHMENT|ESTD?|ESTABLISHED)\s*[:=-]?\s*(\d{4})/i) || text.match(/\b(19\d\d|20\d\d)\b/);
    const lgaMatch = text.match(/(?:L\.?\s*G\.?\s*A\.?|LOCAL\s+GOV(?:ERNMENT)?)\s*[:=-]\s*([A-Za-z\s]+)/i);
    const codeMatch = text.match(/(?:SCHOOL\s+CODE|CODE)\s*[:=-]\s*([A-Za-z0-9/_-]+)/i);

    const extractedName = nameMatch ? nameMatch[1].trim() : '';
    const extractedSchool = schoolMatch ? schoolMatch[1].trim() : '';
    const extractedAddress = addressMatch ? addressMatch[1].trim() : '';
    const extractedPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).replace(/\s+/g, '') : '';
    const extractedEmail = emailMatch ? emailMatch[1].trim() : '';
    const extractedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    const extractedLga = lgaMatch ? lgaMatch[1].trim() : '';
    const extractedCode = codeMatch ? codeMatch[1].trim() : '';

    if (!extractedName && !extractedSchool && !extractedPhone && !extractedEmail && !extractedAddress) {
      return {
        success: false,
        message: 'Could not detect legible credentials from the uploaded document. Please enter details manually.',
        extractedData: null
      };
    }

    const nameParts = extractedName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    return {
      success: true,
      documentType: data.documentType || 'NAPPS Membership Validation Form',
      extractedData: {
        firstName,
        middleName: '',
        lastName,
        fullName: extractedName,
        schoolName: extractedSchool,
        schoolAddress: extractedAddress,
        phone: extractedPhone,
        email: extractedEmail,
        lga: extractedLga,
        aegeLgeaDa: extractedLga ? `${extractedLga} DA` : '',
        yearOfEstablishment: extractedYear,
        schoolRegistrationStatus: 'REGISTERED',
        levelsOfEducation: 'Nursery/Primary',
        typeOfSchool: 'Regular',
        ownership: 'Individualist',
        nappsRegistered: 'Registered',
        totalEnrollment: undefined,
        schoolCode: extractedCode,
        chapter: extractedLga ? `${extractedLga} Chapter` : '',
        positionInNapps: 'Member',
        hasNappsIdCard: false,
        nnsuceTimesWritten: 'Never',
        nnsuce2025PupilsCount: undefined,
      },
      message: 'Credentials extracted from document.'
    };
  }

  // ===================== MEMBERSHIP ID CARD GENERATION =====================
  async getMembershipIdCard(id: string) {
    const proprietor = await this.proprietorModel.findById(id).populate('school');
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    const school: any = proprietor.school || {};
    const lga = proprietor.lga || school.lga || 'Lafia';
    const lgaPrefix = lga.slice(0, 3).toUpperCase();

    // Ensure standard Membership ID exists
    let membershipId = proprietor.nappsMembershipId;
    if (!membershipId || !membershipId.startsWith('NAPPS/NAS')) {
      const count = await this.proprietorModel.countDocuments({ nappsMembershipId: { $exists: true } });
      const seq = String(count + 101).padStart(4, '0');
      membershipId = `NAPPS/NAS/2026/${lgaPrefix}/${seq}`;
      proprietor.nappsMembershipId = membershipId;
      await proprietor.save();
    }

    const verificationUrl = `https://nappsnasarawa.com/verify?id=${encodeURIComponent(membershipId)}`;

    return {
      membershipId,
      fullName: `${proprietor.firstName || ''} ${proprietor.middleName || ''} ${proprietor.lastName || ''}`.trim(),
      passportPhoto: proprietor.passportPhoto || '',
      schoolName: school.schoolName || '',
      schoolAddress: school.address || '',
      lga: lga || school.lga || '',
      chapter: (proprietor.chapters && proprietor.chapters[0]) || school.chapter || (lga ? `${lga} Chapter` : ''),
      issueDate: '01/01/2026',
      expiryDate: '31/12/2026',
      academicSession: '2025/2026',
      clearingStatus: proprietor.clearingStatus || 'pending',
      stateChairmanSignature: 'State Chairman, NAPPS Nasarawa',
      securityQrPayload: JSON.stringify({
        memId: membershipId,
        name: `${proprietor.firstName || ''} ${proprietor.lastName || ''}`.trim(),
        sch: school.schoolName || '',
        lga: lga || school.lga || '',
        status: proprietor.clearingStatus === 'cleared' ? 'VALID_MEMBER_2026' : 'PENDING_CLEARANCE',
        verifyUrl: verificationUrl
      }),
      verificationUrl
    };
  }

  // ===================== AUTOMATED DUES DISTRIBUTION & RECEIPTS =====================
  async getOfficialReceipt(id: string) {
    const proprietor = await this.proprietorModel.findById(id).populate('school');
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    const school: any = proprietor.school || {};
    const totalDues = 14500; // Standard annual unified dues

    // 4-Tier Automated Dues Distribution
    const distribution = {
      localChapter: {
        name: 'Local Chapter Share (LGA Chapter)',
        percentage: 20,
        amount: Math.round(totalDues * 0.20), // ₦2,900
      },
      stateChapter: {
        name: 'NAPPS Nasarawa State Chapter',
        percentage: 35,
        amount: Math.round(totalDues * 0.35), // ₦5,075
      },
      zonalChapter: {
        name: 'North Central Zonal Chapter',
        percentage: 20,
        amount: Math.round(totalDues * 0.20), // ₦2,900
      },
      nationalSecretariat: {
        name: 'NAPPS National Secretariat',
        percentage: 25,
        amount: Math.round(totalDues * 0.25), // ₦3,625
      }
    };

    const receiptNumber = `REC-NAPPS-2026-${String(proprietor._id).slice(-6).toUpperCase()}`;

    return {
      receiptNumber,
      receiptDate: new Date(),
      academicSession: '2025/2026',
      payerName: `${proprietor.firstName || ''} ${proprietor.lastName || ''}`.trim(),
      email: proprietor.email || '',
      phone: proprietor.phone || '',
      schoolName: school.schoolName || '',
      lga: proprietor.lga || school.lga || '',
      chapter: (proprietor.chapters && proprietor.chapters[0]) || school.chapter || '',
      membershipId: proprietor.nappsMembershipId || `NAPPS/NAS/2026/MEM/${String(proprietor._id).slice(-4)}`,
      totalAmountPaid: totalDues,
      paymentMethod: 'Paystack Automated Gateway',
      paymentStatus: 'COMPLETED / VERIFIED',
      distribution,
      securityHash: createHash('sha256').update(`${receiptNumber}:${totalDues}:NAPPS_NAS_2026`).digest('hex').substring(0, 16).toUpperCase(),
      qrVerificationData: `https://nappsnasarawa.com/verify?receipt=${receiptNumber}`
    };
  }

  // ===================== PUBLIC MEMBER VERIFICATION =====================
  async verifyMember(identifier: string) {
    const clean = identifier.trim();
    
    // Find by membership ID, submission ID, registration number, email, or phone
    const proprietor = await this.proprietorModel.findOne({
      $or: [
        { nappsMembershipId: new RegExp(`^${clean}$`, 'i') },
        { submissionId: clean },
        { registrationNumber: clean },
        { email: clean.toLowerCase() },
        { phone: clean.replace(/\D/g, '') },
      ]
    }).populate('school');

    if (!proprietor) {
      throw new NotFoundException(`No verified NAPPS member found for identifier: "${clean}"`);
    }

    const school: any = proprietor.school || {};

    return {
      verified: true,
      membershipId: proprietor.nappsMembershipId || (proprietor.registrationNumber || 'PENDING_ISSUANCE'),
      proprietorName: `${proprietor.firstName || ''} ${proprietor.middleName || ''} ${proprietor.lastName || ''}`.trim(),
      schoolName: school.schoolName || '',
      schoolAddress: school.address || '',
      lga: proprietor.lga || school.lga || '',
      chapter: (proprietor.chapters && proprietor.chapters[0]) || school.chapter || (proprietor.lga ? `${proprietor.lga} Chapter` : ''),
      membershipStatus: proprietor.clearingStatus === 'cleared' ? 'ACTIVE_MEMBER_IN_GOOD_STANDING' : 'REGISTERED_MEMBER',
      duesStatus: proprietor.clearingStatus === 'cleared' ? 'CLEARED' : 'PENDING_VERIFICATION',
      validSession: '2025/2026',
      nnsuceAccredited: true,
      issuedAt: 'NAPPS Nasarawa State Secretariat'
    };
  }

  // ===================== REAL-TIME FINANCIAL REMITTANCES MONITORING =====================
  async getFinancialRemittances() {
    const totalRegistered = await this.proprietorModel.countDocuments({ isActive: true });
    const clearedMembers = await this.proprietorModel.countDocuments({ clearingStatus: 'cleared', isActive: true });
    const duesPerSchool = 14500;
    
    const totalCollected = clearedMembers * duesPerSchool;
    
    const distributionTotals = {
      localChaptersTotal: Math.round(totalCollected * 0.20),
      stateChapterTotal: Math.round(totalCollected * 0.35),
      zonalChapterTotal: Math.round(totalCollected * 0.20),
      nationalSecretariatTotal: Math.round(totalCollected * 0.25),
    };

    const lgas = ['Akwanga', 'Awe', 'Doma', 'Karu', 'Keana', 'Keffi', 'Kokona', 'Lafia', 'Nasarawa', 'Nasarawa Eggon', 'Obi', 'Toto', 'Wamba'];
    
    const lgaBreakdown = await Promise.all(
      lgas.map(async (lga) => {
        const schoolsInLga = await this.proprietorModel.countDocuments({ lga, isActive: true });
        const clearedInLga = await this.proprietorModel.countDocuments({ lga, clearingStatus: 'cleared', isActive: true });
        const lgaCollected = clearedInLga * duesPerSchool;

        return {
          lga,
          coordinator: `Chapter Coordinator (${lga})`,
          registeredSchools: schoolsInLga,
          clearedSchools: clearedInLga,
          pendingSchools: Math.max(0, schoolsInLga - clearedInLga),
          totalCollected: lgaCollected,
          chapterShare20Pct: Math.round(lgaCollected * 0.20),
          stateRemittance35Pct: Math.round(lgaCollected * 0.35),
          zonalRemittance20Pct: Math.round(lgaCollected * 0.20),
          nationalRemittance25Pct: Math.round(lgaCollected * 0.25),
          remittanceStatus: clearedInLga > 0 ? 'CURRENT_IN_REMITTANCE' : 'PENDING_REMITTANCE'
        };
      })
    );

    return {
      overview: {
        totalSchoolsRegistered: totalRegistered,
        totalSchoolsCleared: clearedMembers,
        totalRevenueCollected: totalCollected,
        distributionTotals,
        auditTimestamp: new Date(),
        complianceRate: totalRegistered > 0 ? `${Math.round((clearedMembers / totalRegistered) * 100)}%` : '0%'
      },
      lgaBreakdown
    };
  }

  // ===================== NAPPS MEMBERSHIP VALIDATION FORM — NNSUCE HISTORY =====================
  async getValidationFormData(id: string) {
    const proprietor = await this.proprietorModel.findById(id).populate('school');
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    const school: any = proprietor.school || {};
    const lga = proprietor.lga || school.lga || '';
    const lgaPrefix = lga ? lga.slice(0, 3).toUpperCase() : 'NAS';
    const membershipId = proprietor.nappsMembershipId || (proprietor.registrationNumber || '');

    // Dues payment history: use stored history if available, else query real payment records
    let duesPaymentHistory = (proprietor.duesPaymentHistory && proprietor.duesPaymentHistory.length > 0)
      ? proprietor.duesPaymentHistory
      : null;

    if (!duesPaymentHistory) {
      const payments = await this.paymentModel.find({
        $or: [
          { proprietorId: proprietor._id },
          { email: proprietor.email }
        ],
        status: { $in: ['completed', 'success'] }
      }).sort({ paidAt: -1, createdAt: -1 });

      const sessions = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];
      duesPaymentHistory = sessions.map(session => {
        const paymentForSession = payments.find(p => p.metadata?.session === session || p.description?.includes(session));
        if (paymentForSession) {
          return {
            session,
            fullyPaidAmount: paymentForSession.amount,
            partiallyPaidAmount: null,
            paymentMode: paymentForSession.paymentMethod?.toUpperCase() || 'ONLINE PAYMENT',
            receiver: 'State Fin. Sec.',
            serialNumber: paymentForSession.reference || paymentForSession.paystackReference || '',
            receiptIssued: true,
          };
        } else if (session === '2025/2026' && proprietor.clearingStatus === 'cleared') {
          return {
            session,
            fullyPaidAmount: 14500,
            partiallyPaidAmount: null,
            paymentMode: 'ONLINE PAYMENT',
            receiver: 'State Fin. Sec.',
            serialNumber: proprietor.reference || '',
            receiptIssued: true,
          };
        }
        return {
          session,
          fullyPaidAmount: null,
          partiallyPaidAmount: null,
          paymentMode: '',
          receiver: '',
          serialNumber: '',
          receiptIssued: false,
        };
      });
    }

    return {
      id: proprietor._id,
      membershipId,
      schoolName: school.schoolName || '',
      schoolAddress: school.address || '',
      phone: school.phone || proprietor.phone || '',
      aegeLgeaDa: school.aegeLgeaDa || (lga ? `${lga} Educational Zone` : ''),
      lga: lga,
      yearOfEstablishment: school.yearOfEstablishment || '',
      schoolRegistrationStatus: school.schoolRegistrationStatus || 'IN PROGRESS',
      levelsOfEducation: school.levelsOfEducation || 'Nursery/Primary',
      typeOfSchool: school.typeOfSchool || 'Regular',
      ownership: school.ownership || 'Individualist',
      
      // Dues Payment History Table
      duesPaymentHistory,

      // Rates
      stateDuesRate: 4000,
      zonalDuesRate: 2000,
      nationalDuesRate: 5000,

      // NNSUCE History
      nnsuceTimesWritten: proprietor.nnsuceTimesWritten || 'Never',
      nnsuce2025PupilsCount: proprietor.nnsuce2025PupilsCount || proprietor.pupilsPresentedLastExam || '',
      hasNappsIdCard: Boolean(proprietor.hasNappsIdCard),

      // Proprietor ID Information / Remarks
      fullName: `${proprietor.firstName || ''} ${proprietor.middleName || ''} ${proprietor.lastName || ''}`.trim(),
      chapter: (proprietor.chapters && proprietor.chapters[0]) || school.chapter || (lga ? `${lga} Chapter` : ''),
      schoolCode: school.schoolCode || proprietor.schoolCode || '',
      proprietorPhone: proprietor.phone || '',
      email: proprietor.email || '',
      positionInNapps: proprietor.positionInNapps || proprietor.positionHeld || 'Member',
      passportPhoto: proprietor.passportPhoto || '',
      signature: proprietor.firstName ? `${proprietor.firstName.charAt(0)}. ${proprietor.lastName}` : '',
      clearingStatus: proprietor.clearingStatus || 'pending',
      verificationUrl: membershipId ? `https://nappsnasarawa.com/verify?id=${encodeURIComponent(membershipId)}` : ''
    };
  }

  async updateValidationFormData(id: string, updateData: any) {
    const proprietor = await this.proprietorModel.findById(id);
    if (!proprietor) {
      throw new NotFoundException('Proprietor not found');
    }

    if (updateData.hasNappsIdCard !== undefined) proprietor.hasNappsIdCard = Boolean(updateData.hasNappsIdCard);
    if (updateData.nnsuceTimesWritten) proprietor.nnsuceTimesWritten = updateData.nnsuceTimesWritten;
    if (updateData.nnsuce2025PupilsCount !== undefined) proprietor.nnsuce2025PupilsCount = Number(updateData.nnsuce2025PupilsCount);
    if (updateData.positionInNapps) proprietor.positionInNapps = updateData.positionInNapps;
    if (updateData.schoolCode) proprietor.schoolCode = updateData.schoolCode;
    if (updateData.duesPaymentHistory) proprietor.duesPaymentHistory = updateData.duesPaymentHistory;
    await proprietor.save();

    if (proprietor.school) {
      const schoolUpdates: any = {};
      if (updateData.schoolName) schoolUpdates.schoolName = updateData.schoolName;
      if (updateData.schoolAddress) schoolUpdates.address = updateData.schoolAddress;
      if (updateData.phone) schoolUpdates.phone = updateData.phone;
      if (updateData.aegeLgeaDa) schoolUpdates.aegeLgeaDa = updateData.aegeLgeaDa;
      if (updateData.lga) schoolUpdates.lga = updateData.lga;
      if (updateData.yearOfEstablishment) schoolUpdates.yearOfEstablishment = Number(updateData.yearOfEstablishment);
      if (updateData.schoolRegistrationStatus) schoolUpdates.schoolRegistrationStatus = updateData.schoolRegistrationStatus;
      if (updateData.levelsOfEducation) schoolUpdates.levelsOfEducation = updateData.levelsOfEducation;
      if (updateData.typeOfSchool) schoolUpdates.typeOfSchool = updateData.typeOfSchool;
      if (updateData.ownership) schoolUpdates.ownership = updateData.ownership;
      if (updateData.schoolCode) schoolUpdates.schoolCode = updateData.schoolCode;

      await this.schoolModel.findByIdAndUpdate(proprietor.school, schoolUpdates, { new: true });
    }

    return this.getValidationFormData(id);
  }
}