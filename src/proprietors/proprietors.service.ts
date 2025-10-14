import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
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

@Injectable()
export class ProprietorsService {
  constructor(
    private configService: ConfigService,
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
      // First check if ANY fee configurations exist
      const allFees = await this.feeConfigModel.find().lean();
      console.log(`📊 Total fee configurations in DB: ${allFees.length}`);
      
      if (allFees.length > 0) {
        console.log('📋 Available fees:', allFees.map(f => ({
          name: f.name,
          code: f.code || 'NO_CODE',
          amount: f.amount,
          isActive: f.isActive
        })));
      }

      // Get active registration or membership fee
      const activeFee = await this.feeConfigModel.findOne({
        isActive: true,
        $or: [
          { code: { $in: ['registration_fee', 'membership_fee', 'napps_dues', 'digital_capturing'] } },
          { code: { $exists: false } }, // Include fees without a code field
          { code: null }, // Include fees with null code
          { code: '' } // Include fees with empty code
        ]
      }).sort({ amount: 1 }); // Get the lowest amount

      if (activeFee) {
        console.log(`✅ Using active fee: ${activeFee.name} (${activeFee.code || 'NO_CODE'}) - ₦${activeFee.amount.toLocaleString()}`);
        if (isNewRegistration) {
          console.log(`💰 Doubling fee for new registration: ₦${activeFee.amount.toLocaleString()} x 2 = ₦${(activeFee.amount * 2).toLocaleString()}`);
          return activeFee.amount * 2;
        }
        console.log(`📋 Using original fee for existing proprietor: ₦${activeFee.amount.toLocaleString()}`);
        return activeFee.amount;
      }
      
      console.log('⚠️ No active fee found, checking ANY fee (even inactive)...');
      
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
    const { email, phone, registrationNumber, nappsMembershipId, schoolName, firstName, lastName } = lookupDto;

    if (!email && !phone && !registrationNumber && !nappsMembershipId && !schoolName && !firstName && !lastName) {
      throw new BadRequestException('At least one lookup parameter must be provided');
    }

    console.log('🔍 Lookup called with:', { email, phone, firstName, lastName, schoolName, registrationNumber, nappsMembershipId });

    const filter: FilterQuery<ProprietorDocument> = {};

    if (email) filter.email = { $regex: email, $options: 'i' };
    if (phone) {
      // Remove all non-digit characters for flexible phone matching
      const cleanPhone = phone.replace(/\D/g, '');
      console.log('📱 Searching for phone:', phone, '-> cleaned:', cleanPhone);
      // Search for phone with or without country code/formatting
      filter.phone = { $regex: cleanPhone, $options: 'i' };
    }
    if (firstName) filter.firstName = { $regex: firstName, $options: 'i' };
    if (lastName) filter.lastName = { $regex: lastName, $options: 'i' };
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: 'i' };
    if (registrationNumber) filter.registrationNumber = registrationNumber;
    if (nappsMembershipId) filter.nappsMembershipId = nappsMembershipId;

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
    totalAmountDue: number;
  }> {
    const [
      total,
      statusStats,
      nappsStats,
      clearingStats,
      amountStats
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
}