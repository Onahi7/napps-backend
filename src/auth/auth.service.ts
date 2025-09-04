import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { AdminLoginDto, AdminAuthResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  // Admin login
  async adminLogin(adminLoginDto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const { email, password } = adminLoginDto;

    // Find admin user
    const user = await this.userModel
      .findOne({
        email,
        role: { $in: ['admin', 'super_admin'] },
        isActive: true,
      })
      .select('+password')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        appAccess: user.appAccess,
      },
    };
  }

  // Create admin user (for seeding/setup)
  async createAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: 'admin' | 'super_admin' = 'admin',
    appAccess: string[] = ['connect_hub', 'portal'],
  ) {
    // Check if admin already exists
    const existingAdmin = await this.userModel.findOne({ email }).exec();
    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    // Create admin user
    const admin = new this.userModel({
      email,
      password,
      firstName,
      lastName,
      role,
      appAccess,
      isEmailVerified: true, // Admins are pre-verified
    });

    await admin.save();

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
    };
  }

  // Validate user (used by JWT strategy)
  async validateUser(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  // Get admin profile
  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      appAccess: user.appAccess,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  // Change password
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }
}