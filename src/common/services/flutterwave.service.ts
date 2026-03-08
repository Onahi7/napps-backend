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
    customer_id?: string;
    customer?: any;
    reference: string;        // our tx_ref
    status: string;           // "succeeded" | "failed" | "pending"
    payment_method_details?: {
      type: string;           // "opay"
      id: string;             // payment method ID
    };
    payment_method?: any;
    processor_response?: {
      type: string;           // "approved" | "declined"
      code: string;
    };
    next_action?: {
      type: 'requires_pin' | 'requires_otp' | 'redirect_url' | 'requires_additional_fields' | 'payment_instruction';
      requires_pin?: {};
      requires_otp?: {};
      redirect_url?: { url: string };
      requires_additional_fields?: { fields: string[] };
      payment_instruction?: { note: string };
    };
    created_datetime: string; // ISO 8601
  };
}

export interface CreateCustomerDto {
  email: string;
  name: {
    first: string;
    last: string;
    middle?: string;
  };
  phone: {
    country_code: string;
    number: string;
  };
  address?: {
    city: string;
    country: string;
    line1: string;
    line2?: string;
    postal_code: string;
    state: string;
  };
  meta?: Record<string, any>;
}

export interface CreatePaymentMethodDto {
  type: 'card' | 'mobile_money' | 'ussd' | 'opay' | 'bank_transfer';
  card?: {
    encrypted_card_number: string;
    encrypted_expiry_month: string;
    encrypted_expiry_year: string;
    encrypted_cvv: string;
    nonce: string;
  };
  mobile_money?: {
    country_code: string;
    network: string;
    phone_number: string;
  };
  ussd?: {
    account_bank: string;
  };
}

export interface CreateChargeDto {
  reference: string;
  currency: string;
  customer_id: string;
  payment_method_id: string;
  amount: number;
  redirect_url?: string;
  meta?: Record<string, any>;
  recurring?: boolean;
}

export interface DirectChargeDto {
  amount: number;
  currency: string;
  reference: string;
  customer: {
    email: string;
    name: {
      first: string;
      last: string;
      middle?: string;
    };
    phone: {
      country_code: string;
      number: string;
    };
    address?: any;
  };
  payment_method: {
    type: string;
    [key: string]: any;
  };
  redirect_url?: string;
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
  private readonly flutterwaveHostedSecretKey: string;
  private readonly flutterwaveEncryptionKey: string;
  private readonly v4BaseUrl: string;
  private readonly isTestMode: boolean;

  // OAuth token cache
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // Axios client (token set dynamically per request)
  private readonly flutterwaveClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.flutterwaveClientId = this.configService.get<string>('FLUTTERWAVE_CLIENT_ID') || '';
    this.flutterwaveClientSecret = this.configService.get<string>('FLUTTERWAVE_CLIENT_SECRET') || '';
    // Hosted checkout uses Flutterwave V3 /payments and requires a secret key.
    // Do not use FLUTTERWAVE_CLIENT_SECRET (OAuth client secret) as Bearer token.
    this.flutterwaveHostedSecretKey =
      this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') ||
      this.configService.get<string>('FLUTTERWAVE_HOSTED_SECRET_KEY') ||
      '';
    this.flutterwaveEncryptionKey = this.configService.get<string>('FLUTTERWAVE_ENCRYPTION_KEY') || '';

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.isTestMode = !isProduction;
    this.v4BaseUrl = isProduction
      ? 'https://api.flutterwave.com'
      : 'https://developersandbox-api.flutterwave.com';

    if (!this.flutterwaveClientId || !this.flutterwaveClientSecret) {
      this.logger.warn('Flutterwave V4 credentials not set. Payment functionality will be limited.');
    }
    if (!this.flutterwaveHostedSecretKey) {
      this.logger.warn(
        'Flutterwave hosted checkout key not set. Configure FLUTTERWAVE_SECRET_KEY (or FLUTTERWAVE_HOSTED_SECRET_KEY).',
      );
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
    method: 'get' | 'post' | 'put',
    url: string,
    data?: any,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Trace-Id': crypto.randomUUID(),
      ...extraHeaders,
    };

    // Add idempotency key for POST/PUT requests to prevent duplicate charges
    if (method === 'post' || method === 'put') {
      headers['X-Idempotency-Key'] = crypto.randomUUID();
    }

    const config = { headers };

    if (method === 'get') {
      return (await this.flutterwaveClient.get(url, config)).data as T;
    } else if (method === 'put') {
      return (await this.flutterwaveClient.put(url, data, config)).data as T;
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

      // V3 endpoint still lives at api.flutterwave.com/v3 and requires secret key auth.
      if (!this.flutterwaveHostedSecretKey) {
        throw new BadRequestException(
          'FLUTTERWAVE_SECRET_KEY is required for legacy V3 reference verification',
        );
      }

      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
        { headers: { Authorization: `Bearer ${this.flutterwaveHostedSecretKey}` } },
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
   * Verify webhook signature (V4 uses base64 encoding, not hex)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('FLUTTERWAVE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('FLUTTERWAVE_WEBHOOK_SECRET not configured, skipping signature verification');
      return false; // Fail closed for security
    }

    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('base64'); // V4 uses base64, not hex

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

  // =============== ENCRYPTION UTILITIES ===============

  /**
   * Generate a random nonce for encryption (12 characters)
   */
  generateNonce(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.randomBytes(length))
      .map(byte => chars[byte % chars.length])
      .join('');
  }

  /**
   * Encrypt card data using AES-256-GCM
   */
  async encryptCardData(data: string, nonce: string): Promise<string> {
    if (nonce.length !== 12) {
      throw new Error('Nonce must be exactly 12 characters long');
    }

    const keyBuffer = Buffer.from(this.flutterwaveEncryptionKey, 'base64');
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, Buffer.from(nonce));
    
    let encrypted = cipher.update(data, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    const result = Buffer.concat([encrypted, authTag]);
    
    return result.toString('base64');
  }

  /**
   * Encrypt multiple card fields with the same nonce
   */
  async encryptCardFields(cardData: {
    card_number: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
  }): Promise<{
    encrypted_card_number: string;
    encrypted_expiry_month: string;
    encrypted_expiry_year: string;
    encrypted_cvv: string;
    nonce: string;
  }> {
    const nonce = this.generateNonce();
    
    return {
      encrypted_card_number: await this.encryptCardData(cardData.card_number, nonce),
      encrypted_expiry_month: await this.encryptCardData(cardData.expiry_month, nonce),
      encrypted_expiry_year: await this.encryptCardData(cardData.expiry_year, nonce),
      encrypted_cvv: await this.encryptCardData(cardData.cvv, nonce),
      nonce,
    };
  }

  // =============== CUSTOMER MANAGEMENT ===============

  /**
   * Create a customer entity for future charges
   */
  async createCustomer(customerData: CreateCustomerDto): Promise<{ id: string; [key: string]: any }> {
    try {
      this.logger.log(`Creating customer: ${customerData.email}`);
      
      const response = await this.makeAuthenticatedRequest<any>(
        'post',
        '/customers',
        customerData,
      );

      if (response.status === 'success' && response.data?.id) {
        this.logger.log(`Customer created: ${response.data.id}`);
        return response.data;
      }

      throw new BadRequestException('Failed to create customer');
    } catch (error: any) {
      this.logger.error(`Customer creation failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  /**
   * Retrieve an existing customer by ID
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest<any>(
        'get',
        `/customers/${customerId}`,
      );

      if (response.status === 'success') {
        return response.data;
      }

      throw new BadRequestException('Failed to retrieve customer');
    } catch (error: any) {
      this.logger.error(`Customer retrieval failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  // =============== PAYMENT METHOD MANAGEMENT ===============

  /**
   * Create a payment method (card, mobile money, etc.)
   */
  async createPaymentMethod(
    paymentMethodData: CreatePaymentMethodDto,
  ): Promise<{ id: string; type: string; [key: string]: any }> {
    try {
      this.logger.log(`Creating payment method: ${paymentMethodData.type}`);
      
      const response = await this.makeAuthenticatedRequest<any>(
        'post',
        '/payment-methods',
        paymentMethodData,
      );

      if (response.status === 'success' && response.data?.id) {
        this.logger.log(`Payment method created: ${response.data.id}`);
        return response.data;
      }

      throw new BadRequestException('Failed to create payment method');
    } catch (error: any) {
      this.logger.error(`Payment method creation failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  /**
   * Retrieve a payment method by ID
   */
  async getPaymentMethod(paymentMethodId: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest<any>(
        'get',
        `/payment-methods/${paymentMethodId}`,
      );

      if (response.status === 'success') {
        return response.data;
      }

      throw new BadRequestException('Failed to retrieve payment method');
    } catch (error: any) {
      this.logger.error(`Payment method retrieval failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  // =============== CHARGE MANAGEMENT ===============

  /**
   * Create a charge using customer_id and payment_method_id (General Flow)
   */
  async createCharge(chargeData: CreateChargeDto): Promise<FlutterwaveChargeResponse> {
    try {
      this.logger.log(`Creating charge: ${chargeData.reference}`);
      
      const response = await this.makeAuthenticatedRequest<FlutterwaveChargeResponse>(
        'post',
        '/charges',
        chargeData,
      );

      if (response.status === 'success') {
        this.logger.log(`Charge created: ${response.data.id} - Status: ${response.data.status}`);
        return response;
      }

      throw new BadRequestException('Failed to create charge');
    } catch (error: any) {
      this.logger.error(`Charge creation failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  /**
   * Create a direct charge using orchestrator flow (faster, single API call)
   */
  async createDirectCharge(chargeData: DirectChargeDto): Promise<FlutterwaveChargeResponse> {
    try {
      this.logger.log(`Creating direct charge: ${chargeData.reference}`);
      
      const response = await this.makeAuthenticatedRequest<FlutterwaveChargeResponse>(
        'post',
        '/orchestration/direct-charges',
        chargeData,
      );

      if (response.status === 'success') {
        this.logger.log(`Direct charge created: ${response.data.id} - Status: ${response.data.status}`);
        return response;
      }

      throw new BadRequestException('Failed to create direct charge');
    } catch (error: any) {
      this.logger.error(`Direct charge creation failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  /**
   * Authorize a charge with PIN, OTP, or AVS
   */
  async authorizeCharge(
    chargeId: string,
    authorization: {
      type: 'pin' | 'otp' | 'avs';
      pin?: { encrypted_pin: string; nonce: string };
      otp?: { code: string };
      avs?: {
        address: {
          city: string;
          country: string;
          line1: string;
          line2?: string;
          postal_code: string;
          state: string;
        };
      };
    },
  ): Promise<FlutterwaveChargeResponse> {
    try {
      this.logger.log(`Authorizing charge ${chargeId} with ${authorization.type}`);
      
      const response = await this.makeAuthenticatedRequest<FlutterwaveChargeResponse>(
        'put',
        `/charges/${chargeId}`,
        { authorization },
      );

      if (response.status === 'success') {
        this.logger.log(`Charge authorized: ${response.data.id} - Status: ${response.data.status}`);
        return response;
      }

      throw new BadRequestException('Failed to authorize charge');
    } catch (error: any) {
      this.logger.error(`Charge authorization failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  /**
   * Create a recurring charge (no authorization required)
   */
  async createRecurringCharge(
    customerId: string,
    paymentMethodId: string,
    amount: number,
    currency: string,
    reference: string,
    meta?: Record<string, any>,
  ): Promise<FlutterwaveChargeResponse> {
    try {
      this.logger.log(`Creating recurring charge: ${reference}`);
      
      const response = await this.makeAuthenticatedRequest<FlutterwaveChargeResponse>(
        'post',
        '/charges',
        {
          customer_id: customerId,
          payment_method_id: paymentMethodId,
          amount,
          currency,
          reference,
          recurring: true, // Key flag for recurring payments
          meta,
        },
      );

      if (response.status === 'success') {
        this.logger.log(`Recurring charge created: ${response.data.id}`);
        return response;
      }

      throw new BadRequestException('Failed to create recurring charge');
    } catch (error: any) {
      this.logger.error(`Recurring charge creation failed: ${error?.message || error}`);
      throw this.handleFlutterwaveError(error);
    }
  }

  // =============== ERROR HANDLING ===============

  /**
   * Handle Flutterwave API errors with user-friendly messages
   */
  private handleFlutterwaveError(error: any): never {
    const errorData = error?.response?.data;
    
    if (errorData?.error) {
      const { type, code, message, validation_errors } = errorData.error;
      
      this.logger.error(`Flutterwave Error [${code}]: ${type} - ${message}`);
      
      if (validation_errors?.length > 0) {
        this.logger.error(`Validation errors: ${JSON.stringify(validation_errors)}`);
      }
      
      const userMessage = this.mapErrorToUserMessage(type, code, message);
      throw new BadRequestException(userMessage);
    }
    
    throw new BadRequestException(
      error?.response?.data?.message || error?.message || 'Payment processing failed',
    );
  }

  /**
   * Map Flutterwave error types to user-friendly messages
   */
  private mapErrorToUserMessage(type: string, code: string, message: string): string {
    const errorMap: Record<string, string> = {
      'CLIENT_ENCRYPTION_ERROR': 'Card details could not be processed. Please check your card information and try again.',
      'INSUFFICIENT_FUNDS': 'Insufficient funds in your account. Please try another payment method.',
      'DECLINED': 'Payment was declined by your bank. Please try another card or contact your bank.',
      'AUTHENTICATION_ERROR': 'Payment authentication failed. Please verify your details and try again.',
      'VALIDATION_ERROR': 'Invalid payment information provided. Please check your details.',
      'CARD_EXPIRED': 'Your card has expired. Please use a different card.',
      'INVALID_CARD': 'Invalid card details. Please check your card information.',
      'DO_NOT_HONOR': 'Payment declined by your bank. Please contact your bank or try another card.',
    };
    
    return errorMap[type] || message || 'Payment processing failed. Please try again.';
  }

  // =============== TESTING UTILITIES ===============

  /**
   * Create a test charge with scenario simulation (sandbox only)
   */
  async createTestCharge(
    chargeData: CreateChargeDto,
    scenario?: { auth: string; issuer: string },
  ): Promise<FlutterwaveChargeResponse> {
    if (!this.isTestMode) {
      throw new BadRequestException('Test scenarios are only available in sandbox mode');
    }

    const extraHeaders: Record<string, string> = {};
    
    if (scenario) {
      extraHeaders['X-Scenario-Key'] = `scenario:auth_${scenario.auth}&issuer:${scenario.issuer}`;
      this.logger.log(`Testing scenario: auth_${scenario.auth}, issuer: ${scenario.issuer}`);
    }
    
    const token = await this.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Trace-Id': crypto.randomUUID(),
      'X-Idempotency-Key': crypto.randomUUID(),
      ...extraHeaders,
    };

    const response = await this.flutterwaveClient.post('/charges', chargeData, { headers });
    return response.data as FlutterwaveChargeResponse;
  }
}
