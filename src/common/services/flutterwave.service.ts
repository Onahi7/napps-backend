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
  private readonly flutterwaveClientId: string;
  private readonly flutterwaveClientSecret: string;
  private readonly flutterwaveEncryptionKey: string;
  private readonly isTestMode: boolean;

  // OAuth token cache
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // Axios client (token set dynamically per request)
  private readonly flutterwaveClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.flutterwaveClientId = this.configService.get<string>('FLUTTERWAVE_CLIENT_ID') || '';
    this.flutterwaveClientSecret = this.configService.get<string>('FLUTTERWAVE_CLIENT_SECRET') || '';
    this.flutterwaveEncryptionKey = this.configService.get<string>('FLUTTERWAVE_ENCRYPTION_KEY') || '';
    this.isTestMode = this.configService.get<string>('NODE_ENV') !== 'production';

    if (!this.flutterwaveClientId || !this.flutterwaveClientSecret) {
      this.logger.warn('Flutterwave V4 credentials not set. Payment functionality will be limited.');
    }

    this.flutterwaveClient = axios.create({
      baseURL: 'https://api.flutterwave.com/v3',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get an OAuth access token using V4 client credentials.
   * Tokens are cached and refreshed 60s before expiry.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    this.logger.log('Refreshing Flutterwave OAuth access token...');

    const params = new URLSearchParams();
    params.append('client_id', this.flutterwaveClientId);
    params.append('client_secret', this.flutterwaveClientSecret);
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(
      'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    this.accessToken = response.data.access_token;
    // Refresh 60s before expiry (tokens last ~600s)
    this.tokenExpiresAt = now + (response.data.expires_in - 60) * 1000;

    this.logger.log('Flutterwave OAuth token obtained successfully');
    return this.accessToken!;
  }

  /**
   * Make an authenticated request using the OAuth token.
   */
  private async makeAuthenticatedRequest<T>(
    method: 'get' | 'post',
    url: string,
    data?: any,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    if (method === 'get') {
      return (await this.flutterwaveClient.get(url, config)).data as T;
    }
    return (await this.flutterwaveClient.post(url, data, config)).data as T;
  }

  /**
   * Initialize a payment with Flutterwave
   */
  async initializePayment(
    paymentData: FlutterwavePaymentData
  ): Promise<{ link: string; tx_ref: string }> {
    try {
      this.logger.log(`Initializing Flutterwave payment: ${paymentData.tx_ref}`);

      const response = await this.makeAuthenticatedRequest<any>('post', '/payments', paymentData);

      if (response.status === 'success') {
        return {
          link: response.data.link,
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
   * Verify a payment by its tx_ref (transaction reference).
   * Uses /transactions/verify_by_reference which looks up by tx_ref,
   * NOT by Flutterwave's internal transaction ID.
   */
  async verifyPayment(txRef: string): Promise<FlutterwaveVerifyResponse> {
    try {
      this.logger.log(`Verifying Flutterwave transaction by reference: ${txRef}`);

      const response = await this.makeAuthenticatedRequest<any>(
        'get',
        `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      );

      if (response.status === 'success') {
        return response;
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
   * Get transaction details by Flutterwave transaction ID
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      return await this.makeAuthenticatedRequest<any>('get', `/transactions/${transactionId}`);
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

      const response = await this.makeAuthenticatedRequest<any>(
        'post',
        '/transactions/refund',
        payload,
      );
      
      if (response.status === 'success') {
        return response;
      } else {
        throw new BadRequestException('Refund initiation failed');
      }
    } catch (error: any) {
      this.logger.error(`Flutterwave refund failed: ${error?.message || error}`);
      throw new BadRequestException('Failed to initiate refund');
    }
  }

  /**
   * Get encryption key for frontend
   */
  getEncryptionKey(): string {
    return this.flutterwaveEncryptionKey;
  }

  /**
   * Get client ID for frontend
   */
  getClientId(): string {
    return this.flutterwaveClientId;
  }

  /**
   * Check if Flutterwave is configured
   */
  isConfigured(): boolean {
    return !!this.flutterwaveClientId && !!this.flutterwaveClientSecret;
  }

  /**
   * Check if in test mode
   */
  isTestEnvironment(): boolean {
    return this.isTestMode;
  }
}
