import type { Bindings } from "../env.ts";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
};

export async function sendEmail(
  env: Bindings,
  payload: EmailPayload,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const from = env.EMAIL_FROM || "NADSS <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function paymentConfirmationEmail(input: {
  name: string;
  amount: number;
  reference: string;
  registrationNumber?: string | null;
}): EmailPayload {
  const amount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(input.amount);
  return {
    subject: "Payment Confirmed - NAPPS Nasarawa",
    to: "",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Payment Confirmed</h2>
        <p>Dear ${input.name || "Proprietor"},</p>
        <p>We have received your payment of <strong>${amount}</strong>.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0">Reference</td><td><strong>${input.reference}</strong></td></tr>
          ${
            input.registrationNumber
              ? `<tr><td style="padding:4px 12px 4px 0">Registration No.</td><td><strong>${input.registrationNumber}</strong></td></tr>`
              : ""
          }
        </table>
        <p>Thank you for supporting NAPPS Nasarawa.</p>
      </div>
    `,
  };
}
