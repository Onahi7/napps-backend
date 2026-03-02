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

export interface FlutterwaveChargeResponse {
  status: string;
  message: string;
  data: {
    id: string;               // V4 charge ID, e.g. "chg_nONgeAGY97"
    amount: number;
    currency: string;
    customer_id: string;
    reference: string;        // our tx_ref
    status: string;           // "succeeded" | "failed" | "pending"
    payment_method_details: {
      type: string;           // "opay"
      id: string;             // payment method ID
    };
    processor_response: {
      type: string;           // "approved" | "declined"
      code: string;
    };
    created_datetime: string; // ISO 8601
  };
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
  private readonly flutterwaveHostedSecretKey: string;
  private readonly flutterwaveEncryptionKey: string;
  private readonly v4BaseUrl: string;

  // OAuth token cache
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // Axios client (token set dynamically per request)
  private readonly flutterwaveClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.flutterwaveClientId = this.configService.get<string>('FLUTTERWAVE_CLIENT_ID') || '';
    this.flutterwaveClientSecret = this.configService.get<string>('FLUTTERWAVE_CLIENT_SECRET') || '';
    this.flutterwaveHostedSecretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.flutterwaveEncryptionKey = this.configService.get<string>('FLUTTERWAVE_ENCRYPTION_KEY') || '';

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.v4BaseUrl = isProduction
      ? 'https://api.flutterwave.com'
      : 'https://developersandbox-api.flutterwave.com';

    if (!this.flutterwaveClientId || !this.flutterwaveClientSecret) {
      this.logger.warn('Flutterwave V4 credentials not set. Payment functionality will be limited.');
    }
    if (!this.flutterwaveHostedSecretKey) {
      this.logger.warn('FLUTTERWAVE_SECRET_KEY not set. Hosted checkout initialization will fail until this is configured.');
    }

    this.flutterwaveClient = axios.create({
      baseURL: this.v4BaseUrl,
      headers: { 'Content-Type': 'application/json' },
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
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const config = {
      headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
    };

    if (method === 'get') {
      return (await this.flutterwaveClient.get(url, config)).data as T;
    }
    return (await this.flutterwaveClient.post(url, data, config)).data as T;
  }

  /**
   * Normalize a Nigerian phone number to V4 { country_code, number } format.
   * Accepts: 08012345678 | +2348012345678 | 2348012345678
   */
  private normalizePhone(phone: string): { country_code: string; number: string } {
    let num = phone.replace(/[\s\-()]/g, '');
    if (num.startsWith('+234')) num = num.slice(4);
    else if (num.startsWith('234') && num.length > 10) num = num.slice(3);
    else if (num.startsWith('0')) num = num.slice(1);
    return { country_code: '234', number: num };
  }

  /**
   * Split a full name string into first / last for V4 customer object.
   */
  private splitName(fullName: string): { first: string; last: string } {
    const parts = fullName.trim().split(/\s+/);
    return {
      first: parts[0] || fullName,
      last: parts.length > 1 ? parts.slice(1).join(' ') : parts[0],
    };
  }

  /**
   * Initialize hosted checkout payment so end-user can choose payment method
   * (card, bank transfer, USSD, etc.) on Flutterwave checkout page.
   */
  async initializePayment(
    paymentData: FlutterwavePaymentData,
  ): Promise<{ link: string; tx_ref: string; chargeId?: string }> {
    try {
      this.logger.log(`Initializing hosted Flutterwave payment: ${paymentData.tx_ref}`);

      if (!this.flutterwaveHostedSecretKey) {
        throw new BadRequestException(
          'FLUTTERWAVE_SECRET_KEY is required for hosted checkout initialization',
        );
      }

      const response = await axios.post(
        'https://api.flutterwave.com/v3/payments',
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${this.flutterwaveHostedSecretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.status === 'success' && response.data?.data?.link) {
        return {
          link: response.data.data.link,
          tx_ref: paymentData.tx_ref,
        };
      }

      throw new BadRequestException(response.data?.message || 'Failed to initialize payment');
    } catch (error: any) {
      this.logger.error(`Hosted Flutterwave payment init failed: ${error?.message || error}`);
      if (error?.response) {
        this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException(
        error?.response?.data?.message || error?.message || 'Failed to initialize payment',
      );
    }
  }

  /**
   * Verify a V4 charge by its charge ID (e.g. "chg_nONgeAGY97").
   * This is the primary verification path for new OPay payments.
   */
  async verifyCharge(chargeId: string): Promise<FlutterwaveChargeResponse> {
    try {
      this.logger.log(`Verifying V4 charge: ${chargeId}`);

      const response = await this.makeAuthenticatedRequest<FlutterwaveChargeResponse>(
        'get',
        `/charges/${chargeId}`,
      );

      if (response.status === 'success') {
        return response;
      }

      throw new BadRequestException('Charge verification failed');
    } catch (error: any) {
      this.logger.error(`V4 charge verification failed: ${error?.message || error}`);
      if (error?.response) {
        this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException(
        error?.response?.data?.message || 'Failed to verify payment',
      );
    }
  }

  /**
   * Verify a payment by tx_ref via the V3 API (legacy path for old payments).
   * @deprecated Use verifyCharge(chargeId) for V4 OPay payments.
   */
  async verifyPayment(txRef: string): Promise<FlutterwaveVerifyResponse> {
    try {
      this.logger.log(`Verifying via V3 by reference (legacy): ${txRef}`);

      // V3 endpoint still lives at api.flutterwave.com/v3 regardless of env
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.status === 'success') {
        return response.data;
      }

      throw new BadRequestException('Payment verification failed');
    } catch (error: any) {
      this.logger.error(`V3 legacy verification failed: ${error?.message || error}`);
      if (error?.response) {
        this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException(
        error?.response?.data?.message || 'Failed to verify payment (legacy)',
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
   * Get charge details by V4 charge ID.
   */
  async getTransaction(chargeId: string): Promise<any> {
    try {
      return await this.makeAuthenticatedRequest<any>('get', `/charges/${chargeId}`);
    } catch (error: any) {
      this.logger.error(`Failed to get charge: ${error?.message || error}`);
      throw new BadRequestException('Failed to get charge details');
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
