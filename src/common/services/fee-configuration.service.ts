import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeeConfiguration, FeeConfigurationDocument } from '../../schemas/fee-configuration.schema';

@Injectable()
export class FeeConfigurationService {
  constructor(
    @InjectModel(FeeConfiguration.name)
    private feeConfigModel: Model<FeeConfigurationDocument>,
  ) {}

  /**
   * Get all active fee configurations
   */
  async getActiveFees(type?: string): Promise<any[]> {
    const query: any = { isActive: true };
    
    // Filter by type if provided (e.g., 'registration', 'membership')
    if (type) {
      query.code = { $regex: type, $options: 'i' };
    }

    const fees = await this.feeConfigModel
      .find(query)
      .select('code name amount description paystackSplitCode')
      .sort({ name: 1 })
      .lean();

    return fees.map(fee => ({
      code: fee.code,
      name: fee.name,
      amount: fee.amount,
      description: fee.description,
      paystackSplitCode: fee.paystackSplitCode
    }));
  }

  /**
   * Calculate total fees with breakdown
   */
  async calculateTotalFees(feeCodes?: string[]): Promise<any> {
    const query: any = { isActive: true };
    
    if (feeCodes && feeCodes.length > 0) {
      query.code = { $in: feeCodes };
    }

    const fees = await this.feeConfigModel.find(query).lean();

    let baseAmount = 0;
    let totalPlatformFee = 0;
    let totalProcessingFee = 0;
    let totalNappsFee = 0;

    const feeBreakdown = fees.map(fee => {
      const base = fee.amount * 100; // Convert to kobo
      const feeStructure = fee.feeStructure || {
        platformFeePercentage: 0,
        platformFeeFixed: 0,
        processingFeePercentage: 1.5,
        processingFeeCap: 200000,
        nappsSharePercentage: 0,
        nappsShareFixed: 0
      };

      const platformFee = feeStructure.platformFeeFixed + 
        (base * feeStructure.platformFeePercentage / 100);
      
      const processingFee = Math.min(
        (base * feeStructure.processingFeePercentage / 100),
        feeStructure.processingFeeCap || Infinity
      );
      
      const nappsFee = feeStructure.nappsShareFixed + 
        (base * feeStructure.nappsSharePercentage / 100);

      baseAmount += base;
      totalPlatformFee += platformFee;
      totalProcessingFee += processingFee;
      totalNappsFee += nappsFee;

      return {
        code: fee.code,
        name: fee.name,
        amount: fee.amount,
        amountInKobo: base,
        platformFee: Math.round(platformFee),
        processingFee: Math.round(processingFee),
        nappsFee: Math.round(nappsFee),
        total: Math.round(base + platformFee + processingFee + nappsFee)
      };
    });

    return {
      fees: feeBreakdown,
      summary: {
        baseAmount: Math.round(baseAmount),
        baseAmountNaira: Math.round(baseAmount / 100),
        totalPlatformFee: Math.round(totalPlatformFee),
        totalProcessingFee: Math.round(totalProcessingFee),
        totalNappsFee: Math.round(totalNappsFee),
        grandTotal: Math.round(baseAmount + totalPlatformFee + totalProcessingFee + totalNappsFee),
        grandTotalNaira: Math.round((baseAmount + totalPlatformFee + totalProcessingFee + totalNappsFee) / 100)
      }
    };
  }

  /**
   * Get fee by code
   */
  async getFeeByCode(code: string): Promise<FeeConfigurationDocument | null> {
    return this.feeConfigModel.findOne({ code, isActive: true });
  }

  /**
   * Get fees by codes
   */
  async getFeesByCodes(codes: string[]): Promise<FeeConfigurationDocument[]> {
    return this.feeConfigModel.find({ code: { $in: codes }, isActive: true });
  }
}
