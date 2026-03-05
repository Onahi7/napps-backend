import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { FlutterwaveService } from '../services/flutterwave.service';
import { Request } from 'express';

@ApiTags('Webhooks')
@Controller('webhooks/flutterwave')
export class FlutterwaveWebhookController {
  private readonly logger = new Logger(FlutterwaveWebhookController.name);

  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Handle Flutterwave V4 webhooks',
    description: 'Receives payment notifications from Flutterwave. Signature verification is performed using HMAC-SHA256 with base64 encoding.',
  })
  @ApiHeader({ 
    name: 'flutterwave-signature', 
    required: true,
    description: 'Webhook signature for verification',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid webhook signature',
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() webhookData: any,
    @Headers('flutterwave-signature') signature: string,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Received Flutterwave webhook: ${webhookData.type}`);

      // Verify webhook signature
      if (!signature) {
        this.logger.error('Missing flutterwave-signature header');
        throw new BadRequestException('Webhook signature is required');
      }

      // Get raw body for signature verification
      const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(webhookData);
      
      const isValid = this.flutterwaveService.verifyWebhookSignature(rawBody, signature);
      
      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }

      this.logger.log('Webhook signature verified successfully');

      // Process webhook based on event type
      await this.processWebhook(webhookData);

      return { message: 'Webhook processed successfully' };
    } catch (error: any) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      
      // Return 200 even on error to prevent Flutterwave from retrying
      // Log the error for manual investigation
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      return { message: 'Webhook received but processing failed' };
    }
  }

  /**
   * Process webhook based on event type
   */
  private async processWebhook(webhookData: any): Promise<void> {
    const { type, data, id, timestamp } = webhookData;

    this.logger.log(`Processing webhook ${id} - Type: ${type} - Timestamp: ${timestamp}`);

    switch (type) {
      case 'charge.completed':
        await this.handleChargeCompleted(data);
        break;

      case 'charge.failed':
        await this.handleChargeFailed(data);
        break;

      case 'refund.completed':
        await this.handleRefundCompleted(data);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${type}`);
    }
  }

  /**
   * Handle successful payment
   */
  private async handleChargeCompleted(data: any): Promise<void> {
    this.logger.log(`Payment completed: ${data.reference} - Charge ID: ${data.id}`);
    
    // Log important details
    this.logger.log(`Amount: ${data.amount} ${data.currency}`);
    this.logger.log(`Customer: ${data.customer?.email || 'N/A'}`);
    this.logger.log(`Payment Method: ${data.payment_method?.type || 'N/A'}`);
    this.logger.log(`Status: ${data.status}`);

    // TODO: Update your database with payment success
    // Example:
    // await this.paymentsService.markPaymentAsSuccessful({
    //   reference: data.reference,
    //   chargeId: data.id,
    //   amount: data.amount,
    //   currency: data.currency,
    //   customerEmail: data.customer?.email,
    //   paymentMethod: data.payment_method?.type,
    //   processorResponse: data.processor_response,
    //   webhookData: data,
    // });

    this.logger.log(`Charge completed webhook processed: ${data.reference}`);
  }

  /**
   * Handle failed payment
   */
  private async handleChargeFailed(data: any): Promise<void> {
    this.logger.log(`Payment failed: ${data.reference} - Charge ID: ${data.id}`);
    
    // Log failure details
    this.logger.log(`Amount: ${data.amount} ${data.currency}`);
    this.logger.log(`Customer: ${data.customer?.email || 'N/A'}`);
    this.logger.log(`Status: ${data.status}`);
    this.logger.log(`Processor Response: ${JSON.stringify(data.processor_response)}`);

    // TODO: Update your database with payment failure
    // Example:
    // await this.paymentsService.markPaymentAsFailed({
    //   reference: data.reference,
    //   chargeId: data.id,
    //   failureReason: data.processor_response?.type || 'Unknown',
    //   webhookData: data,
    // });

    this.logger.log(`Charge failed webhook processed: ${data.reference}`);
  }

  /**
   * Handle refund completion
   */
  private async handleRefundCompleted(data: any): Promise<void> {
    this.logger.log(`Refund completed: ${data.reference} - Refund ID: ${data.id}`);
    
    // Log refund details
    this.logger.log(`Amount: ${data.amount} ${data.currency}`);
    this.logger.log(`Status: ${data.status}`);

    // TODO: Update your database with refund completion
    // Example:
    // await this.paymentsService.markRefundAsCompleted({
    //   reference: data.reference,
    //   refundId: data.id,
    //   amount: data.amount,
    //   webhookData: data,
    // });

    this.logger.log(`Refund completed webhook processed: ${data.reference}`);
  }
}
