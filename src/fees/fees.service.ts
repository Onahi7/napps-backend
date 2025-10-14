import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fee } from '../schemas/fee.schema';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';

@Injectable()
export class FeesService {
  constructor(
    @InjectModel(Fee.name) private feeModel: Model<Fee>,
  ) {}

  async create(createFeeDto: CreateFeeDto): Promise<Fee> {
    // Check if fee with same name already exists
    const existingFee = await this.feeModel.findOne({ 
      name: { $regex: new RegExp(`^${createFeeDto.name}$`, 'i') } 
    });

    if (existingFee) {
      throw new BadRequestException('A fee with this name already exists');
    }

    const fee = new this.feeModel(createFeeDto);
    return fee.save();
  }

  async findAll(): Promise<Fee[]> {
    return this.feeModel.find().sort({ createdAt: -1 }).exec();
  }

  async findActive(): Promise<Fee[]> {
    return this.feeModel.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Fee> {
    const fee = await this.feeModel.findById(id).exec();
    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }
    return fee;
  }

  async update(id: string, updateFeeDto: UpdateFeeDto): Promise<Fee> {
    // Check if fee exists
    const fee = await this.feeModel.findById(id).exec();
    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    // If updating name, check for duplicates
    if (updateFeeDto.name && updateFeeDto.name !== fee.name) {
      const existingFee = await this.feeModel.findOne({ 
        name: { $regex: new RegExp(`^${updateFeeDto.name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingFee) {
        throw new BadRequestException('A fee with this name already exists');
      }
    }

    const updatedFee = await this.feeModel
      .findByIdAndUpdate(id, updateFeeDto, { new: true })
      .exec();

    if (!updatedFee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    return updatedFee;
  }

  async remove(id: string): Promise<void> {
    const result = await this.feeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }
  }

  async getTotalActiveFees(): Promise<number> {
    const activeFees = await this.findActive();
    return activeFees.reduce((total, fee) => total + fee.amount, 0);
  }

  async getStats() {
    const [total, active, inactive, totalAmount] = await Promise.all([
      this.feeModel.countDocuments().exec(),
      this.feeModel.countDocuments({ isActive: true }).exec(),
      this.feeModel.countDocuments({ isActive: false }).exec(),
      this.getTotalActiveFees(),
    ]);

    return {
      total,
      active,
      inactive,
      totalAmount,
    };
  }
}
