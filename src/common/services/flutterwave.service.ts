import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface FlutterwavePaymentData {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    phonenumber: string;
    name: string;
  };
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

export interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    ip: string;
    narration: string;
    status: string;
    payment_type: string;
    created_at: string;
    account_id: number;
    customer: {
      id: number;
      name: string;
      phone_number: string;
      email: string;
      created_at: string;
    };
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly flutterwaveClient: AxiosInstance;
  private readonly flutterwaveSecretKey: string;
  private readonly flutterwavePublicKey: string;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    this.flutterwaveSecretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.flutterwavePublicKey = this.configService.get<string>('FLUTTERWAVE_PUBLIC_KEY') || '';
    this.isTestMode = this.configService.get<string>('NODE_ENV') !== 'production';

    if (!this.flutterwaveSecretKey) {
      this.logger.warn('FLUTTERWAVE_SECRET_KEY is not set. Payment functionality will be limited.');
    }

    this.flutterwaveClient = axios.create({
      baseURL: 'https://api.flutterwave.com/v3',
      headers: {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize a payment with Flutterwave
   */
  async initializePayment(
    paymentData: FlutterwavePaymentData
  ): Promise<{ link: string; tx_ref: string }> {
    try {
      this.logger.log(`Initializing Flutterwave payment: ${paymentData.tx_ref}`);

      const response = await this.flutterwaveClient.post('/payments', paymentData);

      if (response.data.status === 'success') {
        return {
          link: response.data.data.link,
          tx_ref: paymentData.tx_ref,
        };
      } else {
        throw new BadRequestException('Failed to initialize payment with Flutterwave');
      }
    } catch (error: any) {
      this.logger.error(`Flutterwave payment initialization failed: ${error?.message || error}`);
      if (error?.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException(
        error?.response?.data?.message || 'Failed to initialize payment with Flutterwave'
      );
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(transactionId: string): Promise<FlutterwaveVerifyResponse> {
    try {
      this.logger.log(`Verifying Flutterwave transaction: ${transactionId}`);

      const response = await this.flutterwaveClient.get(`/transactions/${transactionId}/verify`);

      if (response.data.status === 'success') {
        return response.data;
      } else {
        throw new BadRequestException('Payment verification failed');
      }
    } catch (error: any) {
      this.logger.error(`Flutterwave payment verification failed: ${error?.message || error}`);
      if (error?.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException(
        error?.response?.data?.message || 'Failed to verify payment'
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('FLUTTERWAVE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('FLUTTERWAVE_WEBHOOK_SECRET not configured, skipping signature verification');
      return true;
    }

    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.flutterwaveClient.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get transaction: ${error?.message || error}`);
      throw new BadRequestException('Failed to get transaction details');
    }
  }

  /**
   * Initiate a refund
   */
  async initiateRefund(
    transactionId: string,
    amount?: number
  ): Promise<any> {
    try {
      const payload: any = { id: transactionId };
      if (amount) {
        payload.amount = amount;
      }

      const response = await this.flutterwaveClient.post('/transactions/refund', payload);
      
      if (response.data.status === 'success') {
        return response.data;
      } else {
        throw new BadRequestException('Refund initiation failed');
      }
    } catch (error: any) {
      this.logger.error(`Flutterwave refund failed: ${error?.message || error}`);
      throw new BadRequestException('Failed to initiate refund');
    }
  }

  /**
   * Get public key for frontend
   */
  getPublicKey(): string {
    return this.flutterwavePublicKey;
  }

  /**
   * Check if Flutterwave is configured
   */
  isConfigured(): boolean {
    return !!this.flutterwaveSecretKey && !!this.flutterwavePublicKey;
  }

  /**
   * Check if in test mode
   */
  isTestEnvironment(): boolean {
    return this.isTestMode;
  }
}
