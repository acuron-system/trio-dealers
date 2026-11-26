import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

const verifySchema = z
  .object({
    orderId: z.string().uuid(),
    razorpay_order_id: z.string().min(4).max(120),
    razorpay_payment_id: z.string().min(4).max(120),
    razorpay_signature: z.string().min(10).max(256),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment verification data." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;
  const { ip } = getRequestAuditMeta(request);

  const { data: order } = await db
    .from("orders")
    .select("id, order_no, user_id, total_amount, razorpay_order_id, payment_status")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.razorpay_order_id !== parsed.data.razorpay_order_id) {
    return NextResponse.json(
      { error: "Razorpay order mismatch." },
      { status: 400 }
    );
  }

  const valid = verifyRazorpayPaymentSignature({
    razorpayOrderId: parsed.data.razorpay_order_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    razorpaySignature: parsed.data.razorpay_signature,
  });

  if (!valid) {
    await recordAuditLog(
      {
        request,
        actorId: user.id,
        actorRole: "user",
        action: "payment.razorpay.signature_failed",
        entityType: "order",
        entityId: order.id,
        details: { ip },
      },
      db
    );
    return NextResponse.json(
      { error: "Payment signature verification failed." },
      { status: 400 }
    );
  }

  await db
    .from("orders")
    .update({
      payment_status: "paid",
      razorpay_payment_id: parsed.data.razorpay_payment_id,
      status: "confirmed",
    })
    .eq("id", order.id);

  await db
    .from("sub_orders")
    .update({ status: "confirmed" })
    .eq("parent_order_id", order.id)
    .in("status", ["pending", "placed"]);

  await db
    .from("payments")
    .update({
      provider_payment_id: parsed.data.razorpay_payment_id,
      status: "captured",
      signature_verified: true,
    })
    .eq("provider_order_id", parsed.data.razorpay_order_id);

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: "user",
      action: "payment.razorpay.verified",
      entityType: "order",
      entityId: order.id,
      details: {
        paymentId: parsed.data.razorpay_payment_id,
        amount: order.total_amount,
      },
    },
    db
  );

  if (user.email) {
    await sendTransactionalEmail({
      to: user.email,
      subject: `Trio Dealers Order Confirmed – ${order.order_no}`,
      html: `<p>Thank you for your Trio Dealers order <strong>${order.order_no}</strong>.</p><p>Payment ID: ${parsed.data.razorpay_payment_id}</p><p>Total Paid: ₹${Number(order.total_amount).toLocaleString("en-IN")}</p>`,
    });
  }

  return NextResponse.json({
    verified: true,
    orderNo: order.order_no,
  });
}
