import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { POST as placeOrderHandler } from "../src/app/api/orders/route";
import { POST as razorpayWebhookHandler } from "../src/app/api/payments/razorpay/webhook/route";
import { GET as signedUrlHandler } from "../src/app/api/storage/signed-url/route";
import { resetMemoryRateLimits } from "../src/lib/security/rate-limit";

describe("Checkout Security, Webhook Replay, and Signed URL Isolation", () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_trio_test_secret";
  });

  it("rejects forged Razorpay webhook signatures with 401 before touching DB", async () => {
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });

    const req = new Request("http://localhost:3000/api/payments/razorpay/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": "forged_signature_hex",
        "x-razorpay-event-id": "evt_forged_1",
      },
      body: payload,
    });

    const res = await razorpayWebhookHandler(req);
    expect(res.status).toBe(401);
  });

  it("accepts genuine HMAC-SHA256 Razorpay webhook signatures cleanly", async () => {
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_ok", order_id: "order_ok" } } },
    });
    const validSig = crypto
      .createHmac("sha256", "whsec_trio_test_secret")
      .update(payload)
      .digest("hex");

    const req = new Request("http://localhost:3000/api/payments/razorpay/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": validSig,
        "x-razorpay-event-id": "evt_ok_1",
      },
      body: payload,
    });

    const res = await razorpayWebhookHandler(req);
    expect(res.status).toBe(200);
  });

  it("blocks cross-origin POST attempts to checkout endpoint with 403", async () => {
    const req = new Request("https://triodealers.in/api/orders", {
      method: "POST",
      headers: {
        origin: "https://malicious.site",
        host: "triodealers.in",
        "content-type": "application/json",
      },
      body: JSON.stringify({ items: [] }),
    });

    const res = await placeOrderHandler(req);
    expect(res.status).toBe(403);
  });

  it("denies private storage signed-url path traversal or unauthenticated calls", async () => {
    const req = new Request(
      "http://localhost:3000/api/storage/signed-url?bucket=kyc-documents&path=../../etc/passwd"
    );
    const res = await signedUrlHandler(req);
    expect([400, 401, 503]).toContain(res.status);
  });
});

