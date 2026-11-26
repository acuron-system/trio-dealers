import { describe, it, expect, beforeEach } from "vitest";
import { validatePasswordStrength } from "../src/lib/security/password";
import { assertSameOrigin, getSafeRedirectTarget } from "../src/lib/security/csrf";
import { checkRateLimit, resetMemoryRateLimits } from "../src/lib/security/rate-limit";
import {
  encryptSensitiveField,
  decryptSensitiveField,
  maskBankAccount,
  maskTaxId,
} from "../src/lib/security/crypto";
import { sanitizeRichText, escapeHtml } from "../src/lib/security/sanitize";
import { inspectAndSanitizeUpload } from "../src/lib/security/upload";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "../src/lib/payments/razorpay";
import crypto from "crypto";

describe("Phase 1 Security Baseline", () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    process.env.DATA_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("enforces strong password complexity (>= 10 chars, upper, lower, digit, symbol)", () => {
    expect(validatePasswordStrength("short").valid).toBe(false);
    expect(validatePasswordStrength("lowercaseonly1!").valid).toBe(false);
    expect(validatePasswordStrength("NoDigitsHere!").valid).toBe(false);
    expect(validatePasswordStrength("NoSymbols123").valid).toBe(false);
    expect(validatePasswordStrength("TrioDealer@2026!").valid).toBe(true);
  });

  it("blocks cross-origin state-changing requests and sanitizes open redirects", () => {
    const evilReq = new Request("https://triodealers.in/api/orders", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.example",
        host: "triodealers.in",
      },
    });
    const blocked = assertSameOrigin(evilReq);
    expect(blocked?.status).toBe(403);

    const sameOriginReq = new Request("https://triodealers.in/api/orders", {
      method: "POST",
      headers: {
        origin: "https://triodealers.in",
        host: "triodealers.in",
      },
    });
    expect(assertSameOrigin(sameOriginReq)).toBeNull();

    expect(getSafeRedirectTarget("https://evil.com")).toBe("/");
    expect(getSafeRedirectTarget("//evil.com/phish")).toBe("/");
    expect(getSafeRedirectTarget("/seller/products?tab=drafts")).toBe(
      "/seller/products?tab=drafts"
    );
  });

  it("enforces sliding-window rate limits cleanly", async () => {
    const rule = { requests: 3, windowSeconds: 60 };
    expect((await checkRateLimit("auth_login", "10.0.0.1", rule)).allowed).toBe(true);
    expect((await checkRateLimit("auth_login", "10.0.0.1", rule)).allowed).toBe(true);
    expect((await checkRateLimit("auth_login", "10.0.0.1", rule)).allowed).toBe(true);
    const fourth = await checkRateLimit("auth_login", "10.0.0.1", rule);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("encrypts and decrypts sensitive bank/PAN fields and masks outputs", () => {
    const enc = encryptSensitiveField("50200012345678");
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain("50200012345678");
    expect(decryptSensitiveField(enc)).toBe("50200012345678");

    expect(maskBankAccount("50200012345678")).toBe("••••••••••5678");
    expect(maskTaxId("24AABCU9603R1ZM")).toBe("•••••••••••R1ZM");
  });

  it("strips dangerous XSS tags and event attributes from HTML", () => {
    const clean = sanitizeRichText(
      '<h2>Weave Care</h2><script>alert(1)</script><p onclick="steal()">Wash cold</p><a href="javascript:alert(2)">Bad</a>'
    );
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<h2>Weave Care</h2>");
    expect(escapeHtml('<img onerror="x">')).toContain("&lt;img");
  });

  it("rejects mismatched/spoofed magic bytes and strips JPEG EXIF APP1 segments", () => {
    const fakeSvg = Buffer.from("<svg onload=alert(1)></svg>", "utf8");
    expect(inspectAndSanitizeUpload(fakeSvg, false).ok).toBe(false);

    // Valid minimal JPEG with SOI + APP1(EXIF "Exif") + SOS + EOI
    const exifPayload = Buffer.from("Exif\x00\x00fake-gps-tag", "ascii");
    const app1Len = exifPayload.length + 2;
    const jpegWithExif = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff]),
      exifPayload,
      Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xff, 0xd9]),
    ]);
    const sanitized = inspectAndSanitizeUpload(jpegWithExif, false);
    expect(sanitized.ok).toBe(true);
    if (sanitized.ok) {
      expect(sanitized.data.mime).toBe("image/jpeg");
      expect(sanitized.data.buffer.toString("ascii")).not.toContain("fake-gps-tag");
    }
  });

  it("verifies Razorpay payment and webhook signatures with timing-safe HMAC", () => {
    const secret = "rzp_test_secret_123";
    const orderId = "order_P9xAbc";
    const paymentId = "pay_Q7zXyz";
    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
        secret,
      })
    ).toBe(true);

    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig.replace(/./g, "0"),
        secret,
      })
    ).toBe(false);

    const payload = JSON.stringify({ event: "payment.captured" });
    const whSecret = "whsec_test_999";
    const whSig = crypto.createHmac("sha256", whSecret).update(payload).digest("hex");
    expect(verifyRazorpayWebhookSignature(payload, whSig, whSecret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(payload, "invalid", whSecret)).toBe(false);
  });
});
