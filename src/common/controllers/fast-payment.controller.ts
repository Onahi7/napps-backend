import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FlutterwaveService } from '../services/flutterwave.service';
import { FastPaymentDto, AuthorizeChargeDto, EncryptCardDto } from '../dto/fast-payment.dto';

@ApiTags('Fast Payments')
@Controller('fast-payments')
export class FastPaymentController {
  private readonly logger = new Logger(FastPaymentController.name);

  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Initialize fast payment using orchestrator flow (single API call)',
    description: 'Creates a payment charge in one step without needing to create customer/payment method separately. Ideal for quick payments and guest checkout.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initialized successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'chg_abc123' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            reference: { type: 'string' },
            status: { type: 'string', example: 'pending' },
            next_action: {
              type: 'object',
              description: 'Instructions for completing the payment (redirect, PIN, OTP, etc.)',
            },
          },
        },
      },
    },
  })
  async initializeFastPayment(@Body() fastPaymentDto: FastPaymentDto) {
    this.logger.log(`Initializing fast payment: ${fastPaymentDto.reference}`);
    
    try {
      const response = await this.flutterwaveService.createDirectCharge(fastPaymentDto);
      
      this.logger.log(`Fast payment initialized: ${response.data.id} - Status: ${response.data.status}`);
      
      return response;
    } catch (error: any) {
      this.logger.error(`Fast payment initialization failed: ${error.message}`);
      throw error;
    }
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorize a pending charge with PIN, OTP, or AVS',
    description: 'After initializing a payment, if next_action requires authorization, use this endpoint to submit PIN, OTP, or address verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Charge authorized successfully',
  })
  async authorizeCharge(@Body() authorizeDto: AuthorizeChargeDto) {
    this.logger.log(`Authorizing charge: ${authorizeDto.chargeId} with ${authorizeDto.type}`);
    
    try {
      const authorization: any = { type: authorizeDto.type };
      
      if (authorizeDto.type === 'pin' && authorizeDto.pin) {
        authorization.pin = authorizeDto.pin;
      } else if (authorizeDto.type === 'otp' && authorizeDto.otp) {
        authorization.otp = authorizeDto.otp;
      } else if (authorizeDto.type === 'avs' && authorizeDto.avs) {
        authorization.avs = authorizeDto.avs;
      }
      
      const response = await this.flutterwaveService.authorizeCharge(
        authorizeDto.chargeId,
        authorization,
      );
      
      this.logger.log(`Charge authorized: ${response.data.id} - Status: ${response.data.status}`);
      
      return response;
    } catch (error: any) {
      this.logger.error(`Charge authorization failed: ${error.message}`);
      throw error;
    }
  }

  @Get('verify/:chargeId')
  @ApiOperation({
    summary: 'Verify a charge by ID',
    description: 'Check the status of a charge to confirm payment completion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Charge details retrieved successfully',
  })
  async verifyCharge(@Param('chargeId') chargeId: string) {
    this.logger.log(`Verifying charge: ${chargeId}`);
    
    try {
      const response = await this.flutterwaveService.verifyCharge(chargeId);
      
      this.logger.log(`Charge verified: ${response.data.id} - Status: ${response.data.status}`);
      
      return response;
    } catch (error: any) {
      this.logger.error(`Charge verification failed: ${error.message}`);
      throw error;
    }
  }

  @Post('encrypt-card')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Encrypt card details for secure transmission',
    description: 'Encrypts card information using AES-256-GCM before sending to Flutterwave. Use this for card payments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Card details encrypted successfully',
    schema: {
      type: 'object',
      properties: {
        encrypted_card_number: { type: 'string' },
        encrypted_expiry_month: { type: 'string' },
        encrypted_expiry_year: { type: 'string' },
        encrypted_cvv: { type: 'string' },
        nonce: { type: 'string' },
      },
    },
  })
  async encryptCard(@Body() encryptCardDto: EncryptCardDto) {
    this.logger.log('Encrypting card details');
    
    try {
      const encrypted = await this.flutterwaveService.encryptCardFields(encryptCardDto);
      
      this.logger.log('Card details encrypted successfully');
      
      return encrypted;
    } catch (error: any) {
      this.logger.error(`Card encryption failed: ${error.message}`);
      throw error;
    }
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get Flutterwave configuration for frontend',
    description: 'Returns encryption key and client ID needed for frontend integration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        encryptionKey: { type: 'string' },
        clientId: { type: 'string' },
        isTestMode: { type: 'boolean' },
      },
    },
  })
  getConfig() {
    return {
      encryptionKey: this.flutterwaveService.getEncryptionKey(),
      clientId: this.flutterwaveService.getClientId(),
      isTestMode: this.flutterwaveService.isTestEnvironment(),
    };
  }
}
