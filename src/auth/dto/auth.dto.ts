import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

// Admin authentication (for admin panel access)
export class AdminLoginDto {
  @ApiProperty({ example: 'admin@nappsnasarawa.com', description: 'Admin email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'adminPassword123', description: 'Admin password' })
  @IsString()
  @MinLength(6)
  password: string;
}

// Public proprietor lookup (no authentication required)
export class ProprietorLookupDto {
  @ApiProperty({ 
    example: 'john@example.com or +2348012345678', 
    description: 'Email address or phone number for record lookup' 
  })
  @IsString()
  @IsNotEmpty()
  searchTerm: string; // Can be email or phone
}

// Public proprietor registration (no authentication required)
export class ProprietorRegistrationDto {
  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Middle name', required: false })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ example: 'Smith', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Male', enum: ['Male', 'Female'], description: 'Gender' })
  @IsString()
  @IsNotEmpty()
  sex: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+2348012345678', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Excellence Academy', description: 'Primary school name' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiProperty({ example: 'Excellence Secondary School', description: 'Secondary school name', required: false })
  @IsString()
  @IsOptional()
  schoolName2?: string;

  @ApiProperty({ example: '123 Main Street', description: 'School address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Near City Hall', description: 'Additional address info', required: false })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'Lafia', description: 'Local Government Area' })
  @IsString()
  @IsNotEmpty()
  lga: string;

  @ApiProperty({ example: 'Lafia North', description: 'AEQEO Zone' })
  @IsString()
  @IsNotEmpty()
  aeqeo: string;
}

// Payment initiation (no authentication required)
export class PaymentInitiationDto {
  @ApiProperty({ example: 'hussain.muhammad@email.com', description: 'Proprietor email or phone' })
  @IsString()
  @IsNotEmpty()
  proprietorIdentifier: string; // email or phone

  @ApiProperty({ example: 'NAPPS_DUES', description: 'Type of payment' })
  @IsString()
  @IsNotEmpty()
  paymentType: string;

  @ApiProperty({ example: 25000, description: 'Amount to pay' })
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'https://portal.nappsnasarawa.com/payment/success', description: 'Success redirect URL' })
  @IsString()
  @IsNotEmpty()
  successUrl: string;

  @ApiProperty({ example: 'https://portal.nappsnasarawa.com/payment/cancel', description: 'Cancel redirect URL' })
  @IsString()
  @IsNotEmpty()
  cancelUrl: string;
}

// Admin authentication response
export class AdminAuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ example: 'Bearer', description: 'Token type' })
  token_type: string;

  @ApiProperty({ example: 604800, description: 'Token expiry in seconds' })
  expires_in: number;

  @ApiProperty({ description: 'Admin user information' })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    appAccess: string[];
  };
}

// Proprietor record response (public data only)
export class ProprietorRecordDto {
  @ApiProperty({ example: 'HUSSAIN YAHAYA MUHAMMAD', description: 'Full name' })
  fullName: string;

  @ApiProperty({ example: 'Male', description: 'Gender' })
  sex: string;

  @ApiProperty({ example: 'hussain.muhammad@email.com', description: 'Email address' })
  email: string;

  @ApiProperty({ example: '+2348069770126', description: 'Phone number' })
  phone: string;

  @ApiProperty({ example: 'SUNNAH NURSERY AND PRIMARY SCHOOL', description: 'School name' })
  schoolName: string;

  @ApiProperty({ example: 'ALH. KASIMU IDRIS STREET WAMBA ROAD AKWANGA', description: 'School address' })
  address: string;

  @ApiProperty({ example: 'approved', description: 'Registration status' })
  registrationStatus: string;

  @ApiProperty({ example: 'Registered with Certificate', description: 'NAPPS registration status' })
  nappsRegistered: string;

  @ApiProperty({ example: 'cleared', description: 'Payment clearing status' })
  clearingStatus: string;

  @ApiProperty({ example: 25000, description: 'Amount due for payment' })
  totalAmountDue: number;

  @ApiProperty({ description: 'School enrollment data' })
  enrollment?: any;

  @ApiProperty({ example: '529', description: 'Submission ID' })
  submissionId: string;

  @ApiProperty({ description: 'Participation history' })
  participationHistory: any;
}

// Forgot password (for admin users only)
export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@nappsnasarawa.com', description: 'Admin email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset_token_here', description: 'Password reset token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'newSecurePassword123', description: 'New password (minimum 6 characters)' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}