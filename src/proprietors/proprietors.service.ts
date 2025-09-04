import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
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
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
  ) {}

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

  async lookup(lookupDto: ProprietorLookupDto): Promise<ProprietorDocument[]> {
    const { email, phone, registrationNumber, nappsMembershipId } = lookupDto;
    
    if (!email && !phone && !registrationNumber && !nappsMembershipId) {
      throw new BadRequestException('At least one lookup parameter must be provided');
    }

    const filter: FilterQuery<ProprietorDocument> = {};
    
    if (email) filter.email = { $regex: email, $options: 'i' };
    if (phone) filter.phone = phone;
    if (registrationNumber) filter.registrationNumber = registrationNumber;
    if (nappsMembershipId) filter.nappsMembershipId = nappsMembershipId;

    return await this.proprietorModel.find(filter);
  }

  async update(id: string, updateProprietorDto: UpdateProprietorDto): Promise<ProprietorDocument> {
    try {
      const proprietor = await this.proprietorModel.findByIdAndUpdate(
        id,
        updateProprietorDto,
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
                    message: `Proprietor already exists: ${proprietorData.email}`,
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
    // Map common CSV headers to our schema
    const mapping = {
      'First Name': 'firstName',
      'firstName': 'firstName',
      'first_name': 'firstName',
      'Middle Name': 'middleName',
      'middleName': 'middleName',
      'middle_name': 'middleName',
      'Last Name': 'lastName',
      'lastName': 'lastName',
      'last_name': 'lastName',
      'Sex': 'sex',
      'Gender': 'sex',
      'sex': 'sex',
      'gender': 'sex',
      'Email': 'email',
      'email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'phone': 'phone',
      'Phone Number': 'phone',
      'Registration Number': 'registrationNumber',
      'registrationNumber': 'registrationNumber',
      'registration_number': 'registrationNumber',
      'NAPPS Membership ID': 'nappsMembershipId',
      'nappsMembershipId': 'nappsMembershipId',
      'napps_membership_id': 'nappsMembershipId',
      'Registration Status': 'registrationStatus',
      'registrationStatus': 'registrationStatus',
      'registration_status': 'registrationStatus',
      'NAPPS Registered': 'nappsRegistered',
      'nappsRegistered': 'nappsRegistered',
      'napps_registered': 'nappsRegistered',
      'Awards': 'awards',
      'awards': 'awards',
      'Position Held': 'positionHeld',
      'positionHeld': 'positionHeld',
      'position_held': 'positionHeld',
      'Clearing Status': 'clearingStatus',
      'clearingStatus': 'clearingStatus',
      'clearing_status': 'clearingStatus',
      'Total Amount Due': 'totalAmountDue',
      'totalAmountDue': 'totalAmountDue',
      'total_amount_due': 'totalAmountDue',
    };

    const mapped: any = {};
    
    for (const [csvKey, dbKey] of Object.entries(mapping)) {
      if (record[csvKey] !== undefined && record[csvKey] !== '') {
        let value = record[csvKey];
        
        // Special handling for specific fields
        if (dbKey === 'totalAmountDue') {
          value = parseFloat(value) || 0;
        }
        
        if (dbKey === 'sex' && value) {
          value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
          if (!['Male', 'Female'].includes(value)) {
            value = undefined;
          }
        }
        
        mapped[dbKey] = value;
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
}