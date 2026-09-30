import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface VirtudaDynamicAccountResult {
  reference: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  status: string;
  expectedAmount: number;
  expiryTime: string;
  raw: Record<string, any>;
}

@Injectable()
export class FidelityService {
  private readonly logger = new Logger(FidelityService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookSecret: string;
  private readonly defaultDurationMinutes: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('VIRTUDA_BASE_URL') ||
      'https://api-fidelitymoney.fidelitybank.ng/api'
    ).replace(/\/+$/, '');

    this.clientId =
      this.configService.get<string>('VIRTUDA_CLIENT_ID') || 'MA-3375451006';

    this.clientSecret =
      this.configService.get<string>('VIRTUDA_CLIENT_SECRET') ||
      'aoo4EZlsZehRvlx0AcAMivJBSeZfGbrX';

    this.webhookSecret =
      this.configService.get<string>('FIDELITY_WEBHOOK_SECRET') ||
      '9979d9f332d8c75b44c2460bb209f4a938958d75956b3e2035a97729aa692416';

    this.defaultDurationMinutes = Number(
      this.configService.get<number>('VIRTUDA_DURATION_MINUTES') || 60,
    );

    this.logger.log(
      `🏦 Fidelity (Virtuda) Service initialized. Endpoint: ${this.baseUrl} | Client ID: ${this.clientId}`,
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.clientId && this.clientSecret);
  }

  private extractReference(data: Record<string, any>): string {
    return (
      data.accountGenerationId ||
      data.referenceId ||
      data.processId ||
      data.transactionId ||
      ''
    );
  }

  async initializeDynamicVirtualAccount(params: {
    amount: number;
    durationMinutes?: number;
  }): Promise<VirtudaDynamicAccountResult> {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'Fidelity Bank payment gateway is not properly configured',
      );
    }

    const duration = Math.max(
      params.durationMinutes || this.defaultDurationMinutes,
      10,
    );

    const payload = {
      clientId: this.clientId,
      transactionAmount: String(params.amount),
      theDuration: duration,
    };

    const targetUrl = `${this.baseUrl}/virtual-account/generate-dynamic-virtual-account`;

    this.logger.log(
      `🏦 Generating dynamic Fidelity virtual account for amount: ₦${params.amount} (duration: ${duration}m)`,
    );

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client-secret': this.clientSecret,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await response.json().catch(() => null);

      if (!response.ok || !result) {
        const errorMsg =
          result?.messageCode ||
          result?.message ||
          `Fidelity API returned status ${response.status}`;
        this.logger.error(`Fidelity account generation failed: ${errorMsg}`);
        throw new BadRequestException(`Fidelity gateway error: ${errorMsg}`);
      }

      if (!result.status || !result.data) {
        const failureReason =
          result.messageCode || result.message || 'Generation returned false status';
        this.logger.error(`Fidelity API error: ${failureReason}`);
        throw new BadRequestException(`Failed to generate Fidelity virtual account: ${failureReason}`);
      }

      const data = result.data;
      const reference = this.extractReference(data);

      if (!reference) {
        this.logger.error('Fidelity response did not include a valid reference', data);
        throw new BadRequestException('Fidelity account generated without reference ID');
      }

      const virtualAccountResult: VirtudaDynamicAccountResult = {
        reference,
        accountNumber: data.accountNumber,
        accountName: data.accountName || 'NAPPS Nasarawa State Chapter',
        bankName: data.bankName || data.bank || 'Fidelity Bank',
        status: data.status || 'ASSIGNED',
        expectedAmount: Number(data.expectedAmount || params.amount),
        expiryTime: data.expiryTime,
        raw: data,
      };

      this.logger.log(
        `✅ Generated Fidelity Account: ${virtualAccountResult.accountNumber} | Name: ${virtualAccountResult.accountName} | Ref: ${reference}`,
      );

      return virtualAccountResult;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Network error connecting to Fidelity Bank API: ${error.message}`);
      throw new InternalServerErrorException(
        `Could not connect to Fidelity Bank payment service: ${error.message}`,
      );
    }
  }

  verifyWebhookSignature(rawBody: string, signature?: string): boolean {
    if (!this.webhookSecret || !signature) {
      // If no secret or signature provided, allow webhook through with logging
      this.logger.warn('Fidelity webhook received without signature check requirement');
      return true;
    }

    try {
      const hmacSha256 = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const hmacSha512 = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const isValid =
        signature === hmacSha256 ||
        signature === hmacSha512 ||
        signature === this.webhookSecret;

      return isValid;
    } catch (err) {
      this.logger.error(`Error verifying Fidelity webhook signature: ${err.message}`);
      return false;
    }
  }
}
