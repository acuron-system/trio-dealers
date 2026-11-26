import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const createOrderSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return NextResponse.json(
      { error: "Razorpay gateway credentials are not configured on the server." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rl = await checkRateLimit("checkout", `rzp:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid orderId is required." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  // Read authoritative order total strictly from DB
  const { data: order, error } = await db
    .from("orders")
    .select("id, order_no, user_id, total_amount, payment_status, payment_method, razorpay_order_id")
    .eq("id", parsed.data.orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "Order has already been paid." }, { status: 400 });
  }

  const amountPaise = Math.round(Number(order.total_amount) * 100);
  if (amountPaise <= 0) {
    return NextResponse.json({ error: "Order balance is zero." }, { status: 400 });
  }

  try {
    const rzpOrder = await razorpay.createOrder({
      amountPaise,
      currency: "INR",
      receipt: order.order_no,
      notes: {
        orderId: order.id,
        orderNo: order.order_no,
        userId: user.id,
      },
    });

    await db
      .from("orders")
      .update({ razorpay_order_id: rzpOrder.id })
      .eq("id", order.id);

    await db.from("payments").insert({
      order_id: order.id,
      user_id: user.id,
      provider: "razorpay",
      provider_order_id: rzpOrder.id,
      amount: order.total_amount,
      currency: "INR",
      status: "created",
    });

    return NextResponse.json({
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      orderNo: order.order_no,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to initiate Razorpay payment." },
      { status: 500 }
    );
  }
}

