import crypto from "crypto";

export interface CreatePaymentInput {
  orderId: string;
  amount: number; // in smallest currency unit
  currency: string;
}

export interface CreatePaymentResult {
  redirectUrl: string;
  providerPaymentId: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  providerPaymentId?: string;
  status?: "SUCCEEDED" | "FAILED";
}

/**
 * Every real payment gateway (Omise, Stripe, PromptPay QR, etc.) should
 * implement this interface. The rest of the app (checkout, webhook route)
 * only ever talks to `PaymentProvider`, never to a specific vendor SDK
 * directly — so swapping providers doesn't touch order/wallet logic.
 */
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(providerPaymentId: string): Promise<"SUCCEEDED" | "FAILED" | "PENDING">;
  handleWebhook(rawBody: string, signatureHeader: string | null): WebhookVerificationResult;
  refundPayment(providerPaymentId: string, amount: number): Promise<boolean>;
}

/**
 * TEST-ONLY provider. Never enable this in production — gate it behind
 * PAYMENT_MODE=test. It exists so the checkout → webhook → order-completion
 * pipeline can be exercised end-to-end before a real gateway is wired up,
 * WITHOUT ever marking an order paid just because the frontend said so.
 */
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerPaymentId = `mock_${crypto.randomUUID()}`;
    return {
      providerPaymentId,
      redirectUrl: `/checkout/mock-pay?paymentId=${providerPaymentId}&orderId=${input.orderId}`,
    };
  }

  async verifyPayment(): Promise<"SUCCEEDED" | "FAILED" | "PENDING"> {
    // In test mode, verification still requires an explicit webhook call —
    // this method existing does not itself mark anything paid.
    return "PENDING";
  }

  handleWebhook(rawBody: string, signatureHeader: string | null): WebhookVerificationResult {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || "test-secret";
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!signatureHeader || signatureHeader !== expected) {
      return { valid: false };
    }
    const payload = JSON.parse(rawBody);
    return { valid: true, providerPaymentId: payload.providerPaymentId, status: payload.status };
  }

  async refundPayment(): Promise<boolean> {
    return true;
  }
}

export function getPaymentProvider(): PaymentProvider {
  // PAYMENT_MODE=live should return a real provider implementation instead.
  return new MockPaymentProvider();
}
