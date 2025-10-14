import { Injectable, BadRequestException, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { FeeConfiguration, FeeConfigurationDocument } from '../schemas/fee-configuration.schema';
import {
  CreateFeeConfigurationDto,
  UpdateFeeConfigurationDto,
  FeeQueryDto,
  FeeCalculationDto,
  BulkFeeUpdateDto,
} from './dto/fee-configuration.dto';

@Injectable()
export class FeeConfigurationService {
  private readonly logger = new Logger(FeeConfigurationService.name);

  constructor(
    @InjectModel(FeeConfiguration.name)
    private feeConfigurationModel: Model<FeeConfigurationDocument>,
  ) {}

  // =============== CREATE FEE CONFIGURATION ===============

  async createFeeConfiguration(
    createFeeConfigurationDto: CreateFeeConfigurationDto,
    userId?: string,
  ): Promise<FeeConfigurationDocument> {
    try {
      // Check if fee code already exists
      const existingFee = await this.feeConfigurationModel.findOne({
        code: createFeeConfigurationDto.code,
      });

      if (existingFee) {
        throw new ConflictException(`Fee configuration with code "${createFeeConfigurationDto.code}" already exists`);
      }

      const feeConfiguration = new this.feeConfigurationModel({
        ...createFeeConfigurationDto,
        lastModifiedBy: userId,
      });

      await feeConfiguration.save();
      this.logger.log(`Fee configuration created: ${feeConfiguration.name}`);

      return feeConfiguration;
    } catch (error) {
      this.logger.error(`Failed to create fee configuration: ${error.message}`);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to create fee configuration');
    }
  }

  // =============== GET ALL FEE CONFIGURATIONS ===============

  async findAllFeeConfigurations(query: FeeQueryDto): Promise<FeeConfigurationDocument[]> {
    const filter: FilterQuery<FeeConfigurationDocument> = {};

    if (query.code) {
      filter.code = query.code;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.isRecurring !== undefined) {
      filter.isRecurring = query.isRecurring;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    return await this.feeConfigurationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  // =============== GET ACTIVE FEE CONFIGURATIONS ===============

  async findActiveFeeConfigurations(): Promise<FeeConfigurationDocument[]> {
    const now = new Date();
    
    return await this.feeConfigurationModel
      .find({
        isActive: true,
        $or: [
          { validFrom: { $lte: now }, validUntil: { $gte: now } },
          { validFrom: { $exists: false }, validUntil: { $exists: false } },
          { validFrom: { $lte: now }, validUntil: { $exists: false } },
        ],
      })
      .sort({ name: 1 })
      .exec();
  }

  // =============== GET FEE BY ID ===============

  async findFeeById(id: string): Promise<FeeConfigurationDocument> {
    const fee = await this.feeConfigurationModel.findById(id);

    if (!fee) {
      throw new NotFoundException(`Fee configuration with ID ${id} not found`);
    }

    return fee;
  }

  // =============== GET FEE BY CODE ===============

  async findFeeByCode(code: string): Promise<FeeConfigurationDocument> {
    const fee = await this.feeConfigurationModel.findOne({ code, isActive: true });

    if (!fee) {
      throw new NotFoundException(`Fee configuration with code "${code}" not found`);
    }

    return fee;
  }

  // =============== UPDATE FEE CONFIGURATION ===============

  async updateFeeConfiguration(
    id: string,
    updateFeeConfigurationDto: UpdateFeeConfigurationDto,
    userId?: string,
  ): Promise<FeeConfigurationDocument> {
    try {
      // Check if updating code and if it conflicts
      if (updateFeeConfigurationDto.code) {
        const existingFee = await this.feeConfigurationModel.findOne({
          code: updateFeeConfigurationDto.code,
          _id: { $ne: id },
        });

        if (existingFee) {
          throw new ConflictException(
            `Fee configuration with code "${updateFeeConfigurationDto.code}" already exists`,
          );
        }
      }

      const fee = await this.feeConfigurationModel.findByIdAndUpdate(
        id,
        {
          ...updateFeeConfigurationDto,
          lastModifiedBy: userId,
        },
        { new: true, runValidators: true },
      );

      if (!fee) {
        throw new NotFoundException(`Fee configuration with ID ${id} not found`);
      }

      this.logger.log(`Fee configuration updated: ${fee.name}`);
      return fee;
    } catch (error) {
      this.logger.error(`Failed to update fee configuration: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update fee configuration');
    }
  }

  // =============== DELETE FEE CONFIGURATION ===============

  async deleteFeeConfiguration(id: string): Promise<void> {
    const result = await this.feeConfigurationModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException(`Fee configuration with ID ${id} not found`);
    }

    this.logger.log(`Fee configuration deleted: ${result.name}`);
  }

  // =============== TOGGLE ACTIVE STATUS ===============

  async toggleActiveStatus(id: string, userId?: string): Promise<FeeConfigurationDocument> {
    const fee = await this.findFeeById(id);

    fee.isActive = !fee.isActive;
    fee.lastModifiedBy = userId;

    await fee.save();
    this.logger.log(`Fee configuration ${fee.isActive ? 'activated' : 'deactivated'}: ${fee.name}`);

    return fee;
  }

  // =============== CALCULATE TOTAL FEE ===============

  async calculateFee(feeCalculationDto: FeeCalculationDto): Promise<{
    feeConfiguration: FeeConfigurationDocument;
    baseAmount: number;
    baseAmountKobo: number;
    platformFee: number;
    processingFee: number;
    nappsFee: number;
    totalFees: number;
    totalAmount: number;
    breakdown: {
      baseAmount: string;
      platformFee: string;
      processingFee: string;
      nappsFee: string;
      totalFees: string;
      totalAmount: string;
    };
  }> {
    const fee = await this.findFeeByCode(feeCalculationDto.feeCode);

    const baseAmount = feeCalculationDto.customAmount || fee.amount;
    const baseAmountKobo = Math.round(baseAmount * 100);

    // Validate amount range
    if (fee.minimumAmount && baseAmount < fee.minimumAmount) {
      throw new BadRequestException(
        `Amount must be at least ₦${fee.minimumAmount.toLocaleString()}`,
      );
    }

    if (fee.maximumAmount && baseAmount > fee.maximumAmount) {
      throw new BadRequestException(
        `Amount must not exceed ₦${fee.maximumAmount.toLocaleString()}`,
      );
    }

    const feeStructure = fee.feeStructure || {};

    // Calculate platform fee
    const platformFee =
      (feeStructure.platformFeeFixed || 0) +
      Math.round((baseAmountKobo * (feeStructure.platformFeePercentage || 0)) / 100);

    // Calculate processing fee (capped)
    const processingFeeUncapped = Math.round(
      (baseAmountKobo * (feeStructure.processingFeePercentage || 1.5)) / 100,
    );
    const processingFee = Math.min(
      processingFeeUncapped,
      feeStructure.processingFeeCap || 200000,
    );

    // Calculate NAPPS fee
    const nappsFee =
      (feeStructure.nappsShareFixed || 0) +
      Math.round((baseAmountKobo * (feeStructure.nappsSharePercentage || 0)) / 100);

    const totalFees = platformFee + processingFee + nappsFee;
    const totalAmount = baseAmountKobo + totalFees;

    return {
      feeConfiguration: fee,
      baseAmount,
      baseAmountKobo,
      platformFee,
      processingFee,
      nappsFee,
      totalFees,
      totalAmount,
      breakdown: {
        baseAmount: `₦${baseAmount.toLocaleString()}`,
        platformFee: `₦${(platformFee / 100).toLocaleString()}`,
        processingFee: `₦${(processingFee / 100).toLocaleString()}`,
        nappsFee: `₦${(nappsFee / 100).toLocaleString()}`,
        totalFees: `₦${(totalFees / 100).toLocaleString()}`,
        totalAmount: `₦${(totalAmount / 100).toLocaleString()}`,
      },
    };
  }

  // =============== BULK UPDATE ===============

  async bulkUpdateFees(bulkUpdateDto: BulkFeeUpdateDto, userId?: string): Promise<{
    updated: number;
    failed: number;
  }> {
    let updated = 0;
    let failed = 0;

    for (const feeId of bulkUpdateDto.feeIds) {
      try {
        await this.feeConfigurationModel.findByIdAndUpdate(
          feeId,
          {
            ...(bulkUpdateDto.isActive !== undefined && { isActive: bulkUpdateDto.isActive }),
            ...(bulkUpdateDto.feeStructure && { feeStructure: bulkUpdateDto.feeStructure }),
            lastModifiedBy: userId,
          },
          { runValidators: true },
        );
        updated++;
      } catch (error) {
        this.logger.error(`Failed to update fee ${feeId}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(`Bulk update completed: ${updated} updated, ${failed} failed`);
    return { updated, failed };
  }

  // =============== GET FEE STATISTICS ===============

  async getFeeStatistics(): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    inactiveConfigurations: number;
    recurringFees: number;
    requiredFees: number;
    optionalFees: number;
    averageAmount: number;
    totalConfiguredAmount: number;
  }> {
    const [stats] = await this.feeConfigurationModel.aggregate([
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalConfigurations: { $sum: 1 },
                activeConfigurations: {
                  $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
                },
                inactiveConfigurations: {
                  $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
                },
                recurringFees: {
                  $sum: { $cond: [{ $eq: ['$isRecurring', true] }, 1, 0] },
                },
                requiredFees: {
                  $sum: { $cond: [{ $eq: ['$status', 'required'] }, 1, 0] },
                },
                optionalFees: {
                  $sum: { $cond: [{ $eq: ['$status', 'optional'] }, 1, 0] },
                },
                averageAmount: { $avg: '$amount' },
                totalConfiguredAmount: { $sum: '$amount' },
              },
            },
          ],
        },
      },
    ]);

    const summary = stats.summary[0] || {};

    return {
      totalConfigurations: summary.totalConfigurations || 0,
      activeConfigurations: summary.activeConfigurations || 0,
      inactiveConfigurations: summary.inactiveConfigurations || 0,
      recurringFees: summary.recurringFees || 0,
      requiredFees: summary.requiredFees || 0,
      optionalFees: summary.optionalFees || 0,
      averageAmount: Math.round(summary.averageAmount || 0),
      totalConfiguredAmount: summary.totalConfiguredAmount || 0,
    };
  }

  // =============== SEED DEFAULT FEE CONFIGURATIONS ===============

  async seedDefaultFees(): Promise<void> {
    const defaultFees = [
      {
        name: 'Membership Fee',
        code: 'membership_fee',
        amount: 5000,
        description: 'Annual NAPPS membership fee',
        status: 'required',
        isRecurring: true,
        recurringInterval: 'annually',
      },
      {
        name: 'Registration Fee',
        code: 'registration_fee',
        amount: 10000,
        description: 'One-time school registration fee',
        status: 'required',
      },
      {
        name: 'Digital Capturing',
        code: 'digital_capturing',
        amount: 3000,
        description: 'Digital data capturing service',
        status: 'optional',
      },
    ];

    for (const feeData of defaultFees) {
      const existing = await this.feeConfigurationModel.findOne({ code: feeData.code });
      if (!existing) {
        await this.feeConfigurationModel.create(feeData);
        this.logger.log(`Default fee created: ${feeData.name}`);
      }
    }
  }
}
