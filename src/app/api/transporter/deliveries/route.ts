import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

const deliveryActionSchema = z
  .object({
    deliveryId: z.string().uuid(),
    action: z.enum(["complete", "fail", "reschedule"]),
    otpCode: z.string().trim().max(12).optional().nullable(),
    proofRef: z.string().trim().max(500).optional().nullable(),
    codCollected: z.boolean().optional().default(false),
    reason: z.string().trim().max(300).optional().nullable(),
    rescheduleAt: z.string().optional().nullable(),
  })
  .strict();

export async function PATCH(request: Request) {
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

  const parsed = deliveryActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delivery action payload." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const [{ data: profile }, { data: del }] = await Promise.all([
    db.from("profiles").select("role, is_active").eq("id", user.id).single(),
    db.from("deliveries").select("*").eq("id", parsed.data.deliveryId).single(),
  ]);

  if (!profile || !profile.is_active || !del) {
    return NextResponse.json({ error: "Delivery task not found." }, { status: 404 });
  }

  if (profile.role !== "admin" && del.transporter_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (parsed.data.action === "complete" && del.otp_code) {
    if ((parsed.data.otpCode || "").trim() !== String(del.otp_code).trim()) {
      return NextResponse.json({ error: "Invalid OTP handover code." }, { status: 400 });
    }
  }

  const nextStatus =
    parsed.data.action === "fail"
      ? "failed"
      : parsed.data.action === "reschedule"
      ? "rescheduled"
      : del.leg === "pickup"
      ? "picked_up"
      : "delivered";

  const { data: updated, error } = await db
    .from("deliveries")
    .update({
      status: nextStatus,
      cod_collected: Number(del.cod_amount) > 0 ? Boolean(parsed.data.codCollected) : false,
      failure_reason: parsed.data.reason || null,
      proof_url: parsed.data.proofRef || del.proof_url,
      rescheduled_for: parsed.data.rescheduleAt || null,
      attempt_count: Number(del.attempt_count || 1) + (parsed.data.action === "reschedule" ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", del.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.action === "complete") {
    const subStatus = del.leg === "pickup" ? "picked_up" : "delivered";
    await db
      .from("sub_orders")
      .update({ status: subStatus, updated_at: new Date().toISOString() })
      .eq("id", del.sub_order_id);

    await db.from("order_status_history").insert({
      sub_order_id: del.sub_order_id,
      status: subStatus,
      note:
        del.leg === "pickup"
          ? "Picked up from seller mill by transporter"
          : "Delivered with OTP confirmation",
      changed_by: user.id,
    });
  }

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: profile.role,
      action: `delivery.${parsed.data.action}`,
      entityType: "delivery",
      entityId: del.id,
      details: { subOrderId: del.sub_order_id, status: nextStatus },
    },
    db
  );

  return NextResponse.json({ delivery: updated });
}

