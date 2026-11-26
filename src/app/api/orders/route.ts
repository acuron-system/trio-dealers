import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { recordAuditLog } from "@/lib/security/audit";

const orderItemSchema = z
  .object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(10000),
  })
  .strict();

const addressSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    line1: z.string().trim().min(3).max(250),
    line2: z.string().trim().max(250).optional().nullable(),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
    buyer_gstin: z.string().trim().max(20).optional().nullable(),
  })
  .strict();

const placeOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100),
    address_snapshot: addressSchema,
    payment_method: z.enum(["razorpay", "cod", "bank_transfer", "credit_terms"]),
    payment_proof_url: z.string().trim().max(500).optional().nullable(),
    coupon_code: z.string().trim().max(40).optional().nullable(),
    use_wallet: z.boolean().optional().default(false),
    notes: z.string().trim().max(500).optional().nullable(),
    turnstileToken: z.string().max(4096).optional().nullable(),
  })
  .strict();

function mapRpcErrorToStatus(message: string): { status: number; error: string } {
  const knownCodes = [
    "EMPTY_CART",
    "INVALID_QTY",
    "VARIANT_NOT_FOUND",
    "INSUFFICIENT_STOCK",
    "UNAVAILABLE_PRODUCT",
    "COUPON_INVALID",
    "COUPON_LIMIT_EXCEEDED",
    "CREDIT_UNAUTHORIZED",
    "INSUFFICIENT_CREDIT",
  ];
  for (const code of knownCodes) {
    if (message.includes(code)) {
      const cleaned = message.replace(`${code}:`, "").trim();
      return { status: 400, error: cleaned || message };
    }
  }
  if (message.includes("ACCOUNT_INACTIVE")) {
    return { status: 403, error: "Your account is inactive." };
  }
  return { status: 500, error: message };
}

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database is not configured. Please add Supabase credentials to .env.local." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to place an order." },
      { status: 401 }
    );
  }

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("checkout", `${ip}:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many checkout requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          "Invalid or unexpected fields in checkout submission.",
      },
      { status: 400 }
    );
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: turnstile.error || "Human verification failed." },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const { data: rpcResult, error: rpcError } = await db.rpc(
    "place_marketplace_order",
    {
      p_user_id: user.id,
      p_items: parsed.data.items,
      p_address_snapshot: parsed.data.address_snapshot,
      p_payment_method: parsed.data.payment_method,
      p_payment_proof_url: parsed.data.payment_proof_url || null,
      p_coupon_code: parsed.data.coupon_code || null,
      p_use_wallet: Boolean(parsed.data.use_wallet),
      p_notes: parsed.data.notes || null,
    }
  );

  if (rpcError || !rpcResult) {
    const mapped = mapRpcErrorToStatus(rpcError?.message || "Order placement failed.");
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  // Clear authenticated user's persisted cart table
  await db.from("cart_items").delete().eq("user_id", user.id).then(() => null, () => null);

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: "user",
      action: "order.placed",
      entityType: "order",
      entityId: String(rpcResult.order_id),
      details: {
        orderNo: rpcResult.order_no,
        totalAmount: rpcResult.total_amount,
        paymentMethod: parsed.data.payment_method,
        ip,
        userAgent,
      },
    },
    db
  );

  if (parsed.data.payment_method !== "razorpay" && user.email) {
    await sendTransactionalEmail({
      to: user.email,
      subject: `Trio Dealers Order Placed – ${rpcResult.order_no}`,
      html: `<p>Your Trio Dealers order <strong>${rpcResult.order_no}</strong> has been placed.</p><p>Payment method: ${parsed.data.payment_method}</p><p>Total: ₹${Number(rpcResult.total_amount).toLocaleString("en-IN")}</p>`,
    });
  }

  return NextResponse.json(
    {
      order: {
        id: rpcResult.order_id,
        order_no: rpcResult.order_no,
        total_amount: rpcResult.total_amount,
        subtotal: rpcResult.subtotal,
        tax_total: rpcResult.tax_total,
        shipping_fee: rpcResult.shipping_fee,
        discount_amount: rpcResult.discount_amount,
        wallet_used: rpcResult.wallet_used,
      },
      razorpayRequired: parsed.data.payment_method === "razorpay" && Number(rpcResult.total_amount) > 0,
    },
    { status: 201 }
  );
}
