import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  replyTo?: string;
  tags?: EmailTag[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string; // Content-ID for embedding images
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailTemplate {
  templateName: string;
  data: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private defaultFromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }

    this.resend = new Resend(apiKey);
    this.defaultFromEmail =
      this.configService.get<string>('FROM_EMAIL') || 'noreply@napps.ng';
  }

  // =============== BASIC EMAIL SENDING ===============

  async sendEmail(
    options: EmailOptions,
  ): Promise<{ id: string; success: boolean }> {
    try {
      // Ensure we have either HTML or text content
      if (!options.html && !options.text) {
        throw new BadRequestException(
          'Email must have either HTML or text content',
        );
      }

      const emailData: any = {
        from: options.from || this.defaultFromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        cc: options.cc
          ? Array.isArray(options.cc)
            ? options.cc
            : [options.cc]
          : undefined,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc
            : [options.bcc]
          : undefined,
        reply_to: options.replyTo,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
          content_id: att.cid,
        })),
        tags: options.tags,
      };

      // Add HTML or text content
      if (options.html) {
        emailData.html = options.html;
      }
      if (options.text) {
        emailData.text = options.text;
      }

      const { data, error } = await this.resend.emails.send(emailData);

      if (error) {
        this.logger.error(`Email sending failed: ${error.message}`, error);
        throw new BadRequestException(`Email sending failed: ${error.message}`);
      }

      this.logger.log(`Email sent successfully with ID: ${data?.id}`);
      return { id: data?.id || '', success: true };
    } catch (error) {
      this.logger.error(`Email service error: ${error.message}`);
      throw new BadRequestException(`Email service error: ${error.message}`);
    }
  }

  // =============== TEMPLATE-BASED EMAILS ===============

  async sendWelcomeEmail(
    email: string,
    name: string,
  ): Promise<{ id: string; success: boolean }> {
    const html = this.generateWelcomeTemplate(name);

    return this.sendEmail({
      to: email,
      subject:
        'Welcome to NAPPS - Nigeria Association of Proprietors of Private Schools',
      html,
      tags: [{ name: 'category', value: 'welcome' }],
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<{ id: string; success: boolean }> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    const html = this.generatePasswordResetTemplate(name, resetUrl);

    return this.sendEmail({
      to: email,
      subject: 'NAPPS - Password Reset Request',
      html,
      tags: [{ name: 'category', value: 'password-reset' }],
    });
  }

  async sendPaymentConfirmationEmail(
    email: string,
    paymentDetails: {
      reference: string;
      amount: number;
      paymentType: string;
      proprietorName: string;
      schoolName?: string;
    },
  ): Promise<{ id: string; success: boolean }> {
    const html = this.generatePaymentConfirmationTemplate(paymentDetails);

    return this.sendEmail({
      to: email,
      subject: `Payment Confirmation - ${paymentDetails.reference}`,
      html,
      tags: [
        { name: 'category', value: 'payment-confirmation' },
        { name: 'payment-type', value: paymentDetails.paymentType },
      ],
    });
  }

  async sendSchoolRegistrationEmail(
    email: string,
    schoolDetails: {
      schoolName: string;
      proprietorName: string;
      registrationNumber?: string;
    },
  ): Promise<{ id: string; success: boolean }> {
    const html = this.generateSchoolRegistrationTemplate(schoolDetails);

    return this.sendEmail({
      to: email,
      subject: 'School Registration Successful - NAPPS',
      html,
      tags: [{ name: 'category', value: 'school-registration' }],
    });
  }

  async sendNewsletterEmail(
    emails: string[],
    newsletterData: {
      title: string;
      content: string;
      featuredImage?: string;
    },
  ): Promise<{ id: string; success: boolean }> {
    const html = this.generateNewsletterTemplate(newsletterData);

    return this.sendEmail({
      to: emails,
      subject: `NAPPS Newsletter - ${newsletterData.title}`,
      html,
      tags: [{ name: 'category', value: 'newsletter' }],
    });
  }

  async sendEventNotificationEmail(
    emails: string[],
    eventDetails: {
      eventName: string;
      eventDate: Date;
      eventLocation: string;
      description: string;
      registrationLink?: string;
    },
  ): Promise<{ id: string; success: boolean }> {
    const html = this.generateEventNotificationTemplate(eventDetails);

    return this.sendEmail({
      to: emails,
      subject: `Event Notification - ${eventDetails.eventName}`,
      html,
      tags: [{ name: 'category', value: 'event-notification' }],
    });
  }

  // =============== ADMIN NOTIFICATIONS ===============

  async sendAdminNotificationEmail(
    subject: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<{ id: string; success: boolean }> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) {
      throw new BadRequestException('Admin email not configured');
    }

    const html = this.generateAdminNotificationTemplate(message, data);

    return this.sendEmail({
      to: adminEmail,
      subject: `NAPPS Admin Alert - ${subject}`,
      html,
      tags: [{ name: 'category', value: 'admin-notification' }],
    });
  }

  // =============== BULK EMAIL OPERATIONS ===============

  async sendBulkEmails(
    recipients: { email: string; data: Record<string, any> }[],
    template: EmailTemplate,
  ): Promise<{ sent: number; failed: number; results: any[] }> {
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const html = this.generateTemplateWithData(template.templateName, {
          ...template.data,
          ...recipient.data,
        });

        const result = await this.sendEmail({
          to: recipient.email,
          subject: template.data.subject || 'NAPPS Communication',
          html,
        });

        results.push({ email: recipient.email, success: true, id: result.id });
        sent++;
      } catch (error) {
        results.push({
          email: recipient.email,
          success: false,
          error: error.message,
        });
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(`Bulk email completed: ${sent} sent, ${failed} failed`);
    return { sent, failed, results };
  }

  // =============== EMAIL TEMPLATES ===============

  private generateWelcomeTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome to NAPPS</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to NAPPS</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Nigeria Association of Proprietors of Private Schools</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e40af; margin-top: 0;">Dear ${name},</h2>
          
          <p>Welcome to the Nigeria Association of Proprietors of Private Schools (NAPPS)! We're thrilled to have you join our community of dedicated education leaders.</p>
          
          <p>As a member of NAPPS, you'll have access to:</p>
          <ul style="color: #555;">
            <li>Professional development opportunities</li>
            <li>Networking with fellow school proprietors</li>
            <li>Resources and best practices for school management</li>
            <li>Updates on education policies and regulations</li>
            <li>Exclusive events and workshops</li>
          </ul>
          
          <p>We're committed to supporting private school education in Nigeria and helping our members succeed.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL')}/dashboard" 
               style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Access Your Dashboard
            </a>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The NAPPS Team</strong></p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
          <p>© 2025 Nigeria Association of Proprietors of Private Schools. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(
    name: string,
    resetUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Password Reset - NAPPS</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc2626; margin-top: 0;">Hello ${name},</h2>
          
          <p>We received a request to reset your NAPPS account password. If you didn't make this request, you can safely ignore this email.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Reset Your Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The NAPPS Security Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentConfirmationTemplate(paymentDetails: {
    reference: string;
    amount: number;
    paymentType: string;
    proprietorName: string;
    schoolName?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Confirmation - NAPPS</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #059669; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Payment Confirmed</h1>
          <p style="margin: 10px 0 0 0;">Thank you for your payment</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #059669; margin-top: 0;">Dear ${paymentDetails.proprietorName},</h2>
          
          <p>Your payment has been successfully processed. Here are the details:</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Reference:</td>
                <td style="padding: 8px 0; color: #1f2937;">${paymentDetails.reference}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Amount:</td>
                <td style="padding: 8px 0; color: #1f2937;">₦${(paymentDetails.amount / 100).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Payment Type:</td>
                <td style="padding: 8px 0; color: #1f2937;">${paymentDetails.paymentType}</td>
              </tr>
              ${
                paymentDetails.schoolName
                  ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">School:</td>
                <td style="padding: 8px 0; color: #1f2937;">${paymentDetails.schoolName}</td>
              </tr>`
                  : ''
              }
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Date:</td>
                <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <p>A receipt has been generated and your account has been updated accordingly.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL')}/payments" 
               style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               View Payment History
            </a>
          </div>
          
          <p>If you have any questions about this payment, please contact our support team.</p>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The NAPPS Finance Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  private generateSchoolRegistrationTemplate(schoolDetails: {
    schoolName: string;
    proprietorName: string;
    registrationNumber?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e40af; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">School Registration Successful</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e40af; margin-top: 0;">Congratulations ${schoolDetails.proprietorName}!</h2>
          
          <p><strong>${schoolDetails.schoolName}</strong> has been successfully registered with NAPPS.</p>
          
          ${
            schoolDetails.registrationNumber
              ? `
          <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46;"><strong>Registration Number:</strong> ${schoolDetails.registrationNumber}</p>
          </div>`
              : ''
          }
          
          <p>Your school is now part of the NAPPS community and can access all member benefits.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL')}/schools" 
               style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Manage Your Schools
            </a>
          </div>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The NAPPS Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  private generateNewsletterTemplate(newsletterData: {
    title: string;
    content: string;
    featuredImage?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e40af; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">NAPPS Newsletter</h1>
          <h2 style="margin: 10px 0 0 0; font-weight: normal;">${newsletterData.title}</h2>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          ${
            newsletterData.featuredImage
              ? `
          <img src="${newsletterData.featuredImage}" alt="${newsletterData.title}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 6px; margin-bottom: 20px;">
          `
              : ''
          }
          
          <div style="color: #374151;">
            ${newsletterData.content}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL')}" 
               style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Visit NAPPS Website
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateEventNotificationTemplate(eventDetails: {
    eventName: string;
    eventDate: Date;
    eventLocation: string;
    description: string;
    registrationLink?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7c3aed; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Event Notification</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #7c3aed; margin-top: 0;">${eventDetails.eventName}</h2>
          
          <div style="background: #faf5ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <p><strong>📅 Date:</strong> ${eventDetails.eventDate.toLocaleDateString()}</p>
            <p><strong>📍 Location:</strong> ${eventDetails.eventLocation}</p>
          </div>
          
          <p>${eventDetails.description}</p>
          
          ${
            eventDetails.registrationLink
              ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${eventDetails.registrationLink}" 
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Register Now
            </a>
          </div>`
              : ''
          }
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The NAPPS Events Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  private generateAdminNotificationTemplate(
    message: string,
    data?: Record<string, any>,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Admin Notification</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p><strong>Message:</strong> ${message}</p>
          
          ${
            data
              ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Additional Data:</h3>
            <pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
          </div>`
              : ''
          }
          
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateTemplateWithData(
    templateName: string,
    data: Record<string, any>,
  ): string {
    // This is a simple template system - in production, you might want to use a more robust template engine
    const templates: { [key: string]: string } = {
      welcome: this.generateWelcomeTemplate(data.name),
      newsletter: this.generateNewsletterTemplate({
        title: data.title || 'Newsletter',
        content: data.content || 'No content available',
        featuredImage: data.featuredImage,
      }),
      // Add more templates as needed
    };

    return (
      templates[templateName] || `<p>${data.message || 'No template found'}</p>`
    );
  }
}
