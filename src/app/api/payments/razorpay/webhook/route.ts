import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { recordAuditLog } from "@/lib/security/audit";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    `rzp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ received: true, skipped: "service-role-unconfigured" });
  }

  // Idempotency guard against replay attacks using unique webhook_event_id
  const { data: existingEvent } = await adminClient
    .from("payments")
    .select("id")
    .eq("webhook_event_id", eventId)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const eventName = String(payload?.event || "");
  const paymentEntity = payload?.payload?.payment?.entity;
  const rzpOrderId = paymentEntity?.order_id as string | undefined;
  const rzpPaymentId = paymentEntity?.id as string | undefined;

  if (rzpOrderId) {
    const { data: order } = await adminClient
      .from("orders")
      .select("id, user_id, total_amount, payment_status")
      .eq("razorpay_order_id", rzpOrderId)
      .maybeSingle();

    if (order) {
      if (eventName === "payment.captured" && order.payment_status !== "paid") {
        await adminClient
          .from("orders")
          .update({
            payment_status: "paid",
            razorpay_payment_id: rzpPaymentId || null,
            status: "confirmed",
          })
          .eq("id", order.id);

        await adminClient
          .from("sub_orders")
          .update({ status: "confirmed" })
          .eq("parent_order_id", order.id)
          .in("status", ["pending", "placed"]);

        await adminClient.from("payments").upsert(
          {
            order_id: order.id,
            user_id: order.user_id,
            provider: "razorpay",
            provider_order_id: rzpOrderId,
            provider_payment_id: rzpPaymentId || null,
            webhook_event_id: eventId,
            amount: order.total_amount,
            currency: "INR",
            status: "captured",
            signature_verified: true,
            raw_event: payload,
          },
          { onConflict: "webhook_event_id" }
        );
      } else if (eventName === "payment.failed") {
        await adminClient
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", order.id)
          .neq("payment_status", "paid");
      }

      await recordAuditLog(
        {
          request,
          actorRole: "webhook",
          action: `webhook.razorpay.${eventName}`,
          entityType: "order",
          entityId: order.id,
          details: { eventId, rzpOrderId, rzpPaymentId },
        },
        adminClient
      );
    }
  }

  return NextResponse.json({ received: true, eventId });
}
