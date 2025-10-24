import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    this.logger.debug(`JWT payload received: ${JSON.stringify(payload)}`);
    
    const user = await this.userModel
      .findById(payload.sub)
      .select('+password')
      .exec();

    if (!user) {
      this.logger.warn(`User not found for ID: ${payload.sub}`);
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!user.isActive) {
      this.logger.warn(`Inactive user attempted access: ${user.email}`);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Only allow admin users to authenticate
    if (!['admin', 'super_admin'].includes(user.role)) {
      this.logger.warn(`User with insufficient role attempted access: ${user.email} (role: ${user.role})`);
      throw new UnauthorizedException('Insufficient privileges');
    }

    this.logger.debug(`User authenticated successfully: ${user.email} (role: ${user.role})`);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      appAccess: user.appAccess,
    };
  }
}