import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEmail, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NameDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  first: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  last: string;

  @ApiProperty({ example: 'Michael', required: false })
  @IsString()
  @IsOptional()
  middle?: string;
}

class PhoneDto {
  @ApiProperty({ example: '234' })
  @IsString()
  country_code: string;

  @ApiProperty({ example: '8012345678' })
  @IsString()
  number: string;
}

class AddressDto {
  @ApiProperty({ example: 'Lagos' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'NG' })
  @IsString()
  country: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  line1: string;

  @ApiProperty({ example: 'Apt 4', required: false })
  @IsString()
  @IsOptional()
  line2?: string;

  @ApiProperty({ example: '100001' })
  @IsString()
  postal_code: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  state: string;
}

class CustomerDto {
  @ApiProperty({ example: '[email protected]' })
  @IsEmail()
  email: string;

  @ApiProperty({ type: NameDto })
  @ValidateNested()
  @Type(() => NameDto)
  name: NameDto;

  @ApiProperty({ type: PhoneDto })
  @ValidateNested()
  @Type(() => PhoneDto)
  phone: PhoneDto;

  @ApiProperty({ type: AddressDto, required: false })
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;
}

class PaymentMethodDto {
  @ApiProperty({ 
    example: 'opay',
    description: 'Payment method type: card, mobile_money, ussd, opay, bank_transfer',
  })
  @IsString()
  type: string;

  @ApiProperty({ 
    required: false,
    description: 'Additional payment method data (e.g., card details, mobile money info)',
  })
  @IsObject()
  @IsOptional()
  [key: string]: any;
}

export class FastPaymentDto {
  @ApiProperty({ example: 5000, description: 'Amount in smallest currency unit (e.g., kobo for NGN)' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  currency: string;

  @ApiProperty({ example: 'NAPPS-2026-1234', description: 'Unique payment reference' })
  @IsString()
  reference: string;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ApiProperty({ type: PaymentMethodDto })
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  payment_method: PaymentMethodDto;

  @ApiProperty({ example: 'https://yoursite.com/payment/callback', required: false })
  @IsString()
  @IsOptional()
  redirect_url?: string;

  @ApiProperty({ 
    required: false,
    description: 'Additional metadata for the payment',
  })
  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}

export class AuthorizeChargeDto {
  @ApiProperty({ example: 'chg_abc123', description: 'Charge ID to authorize' })
  @IsString()
  chargeId: string;

  @ApiProperty({ 
    example: 'pin',
    description: 'Authorization type: pin, otp, or avs',
  })
  @IsString()
  type: 'pin' | 'otp' | 'avs';

  @ApiProperty({ 
    required: false,
    description: 'Encrypted PIN with nonce (for PIN authorization)',
  })
  @IsObject()
  @IsOptional()
  pin?: {
    encrypted_pin: string;
    nonce: string;
  };

  @ApiProperty({ 
    required: false,
    description: 'OTP code (for OTP authorization)',
  })
  @IsObject()
  @IsOptional()
  otp?: {
    code: string;
  };

  @ApiProperty({ 
    required: false,
    description: 'Address details (for AVS authorization)',
  })
  @IsObject()
  @IsOptional()
  avs?: {
    address: AddressDto;
  };
}

export class EncryptCardDto {
  @ApiProperty({ example: '5531886652142950' })
  @IsString()
  card_number: string;

  @ApiProperty({ example: '09' })
  @IsString()
  expiry_month: string;

  @ApiProperty({ example: '32' })
  @IsString()
  expiry_year: string;

  @ApiProperty({ example: '564' })
  @IsString()
  cvv: string;
}
