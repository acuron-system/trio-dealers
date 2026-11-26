import crypto from "crypto";

export interface RazorpayOrderResponse {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export interface RazorpayRestClient {
  createOrder(params: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrderResponse>;
  createRefund(params: {
    paymentId: string;
    amountPaise?: number;
    notes?: Record<string, string>;
  }): Promise<{ id: string; status: string; amount: number }>;
}

/**
 * Returns a zero-dependency Razorpay REST client authenticated via HTTP Basic Auth.
 */
export function getRazorpayClient(): RazorpayRestClient | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;

  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");

  return {
    async createOrder({ amountPaise, currency = "INR", receipt, notes }) {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amountPaise),
          currency,
          receipt,
          notes: notes || {},
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Razorpay order creation failed: ${text}`);
      }

      return (await response.json()) as RazorpayOrderResponse;
    },

    async createRefund({ paymentId, amountPaise, notes }) {
      const payload: Record<string, unknown> = { notes: notes || {} };
      if (typeof amountPaise === "number" && amountPaise > 0) {
        payload.amount = Math.round(amountPaise);
      }

      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Razorpay refund creation failed: ${text}`);
      }

      return (await response.json()) as {
        id: string;
        status: string;
        amount: number;
      };
    },
  };
}

/**
 * Verifies Razorpay Checkout payment signature server-side using timing-safe HMAC SHA-256.
 */
export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret?: string;
}): boolean {
  const secret = params.secret || process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.razorpaySignature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");

  const actualBuf = Buffer.from(params.razorpaySignature.trim(), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actualBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Verifies Razorpay webhook HMAC-SHA256 signature on raw request body bytes.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret?: string
): boolean {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const actualBuf = Buffer.from(signatureHeader.trim(), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actualBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
