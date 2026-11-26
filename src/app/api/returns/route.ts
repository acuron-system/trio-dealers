import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { recordAuditLog } from "@/lib/security/audit";

const createReturnSchema = z
  .object({
    subOrderId: z.string().uuid(),
    returnType: z.enum(["return", "exchange"]).default("return"),
    reason: z.string().trim().min(5).max(500),
    refundMethod: z.enum(["wallet", "original_payment"]).default("wallet"),
    evidenceUrl: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

const updateReturnSchema = z
  .object({
    returnId: z.string().uuid(),
    status: z.enum(["approved", "rejected", "pickup_scheduled", "received", "refunded"]),
    adminNote: z.string().trim().max(400).optional().nullable(),
  })
  .strict();

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ returns: [] });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    const adminClient = createAdminClient() || supabase;
    const { data } = await adminClient
      .from("returns")
      .select("*, sub_order:sub_orders(sub_order_no, total, shop:shops(shop_name))")
      .order("created_at", { ascending: false });
    return NextResponse.json({ returns: data || [] });
  }

  if (profile?.role === "shop") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!shop) return NextResponse.json({ returns: [] });
    const { data } = await supabase
      .from("returns")
      .select("*, sub_order:sub_orders!inner(sub_order_no, total, shop_id)")
      .eq("sub_order.shop_id", shop.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ returns: data || [] });
  }

  const { data } = await supabase
    .from("returns")
    .select("*, sub_order:sub_orders(sub_order_no, total)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ returns: data || [] });
}

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

  const parsed = createReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid return data." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const { data: subOrder } = await db
    .from("sub_orders")
    .select("id, total, status, parent_order:orders!inner(user_id)")
    .eq("id", parsed.data.subOrderId)
    .single();

  if (!subOrder || (subOrder.parent_order as any)?.user_id !== user.id) {
    return NextResponse.json({ error: "Sub-order not found for this account." }, { status: 404 });
  }

  const { data: created, error } = await db
    .from("returns")
    .insert({
      sub_order_id: subOrder.id,
      user_id: user.id,
      return_type: parsed.data.returnType,
      reason: parsed.data.reason,
      refund_method: parsed.data.refundMethod,
      refund_amount: subOrder.total,
      evidence_url: parsed.data.evidenceUrl || null,
      status: "requested",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: "user",
      action: "return.requested",
      entityType: "return",
      entityId: created.id,
    },
    db
  );

  return NextResponse.json({ returnRequest: created }, { status: 201 });
}

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

  const parsed = updateReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid return update." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const [{ data: profile }, { data: ret }] = await Promise.all([
    db.from("profiles").select("role").eq("id", user.id).single(),
    db
      .from("returns")
      .select("*, sub_order:sub_orders(id, shop_id, parent_order_id, shop:shops(owner_id))")
      .eq("id", parsed.data.returnId)
      .single(),
  ]);

  if (!profile || !ret) {
    return NextResponse.json({ error: "Return record not found." }, { status: 404 });
  }

  const isShopOwner = (ret.sub_order as any)?.shop?.owner_id === user.id;
  if (profile.role !== "admin" && !isShopOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: updated, error } = await db
    .from("returns")
    .update({
      status: parsed.data.status,
      admin_note: parsed.data.adminNote || ret.admin_note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ret.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger settlement refund when status enters refunded
  if (parsed.data.status === "refunded" && ret.status !== "refunded") {
    const refundAmt = Number(ret.refund_amount || 0);
    if (refundAmt > 0) {
      if (ret.refund_method === "wallet") {
        const { data: latestWallet } = await db
          .from("wallet_ledger")
          .select("balance_after")
          .eq("user_id", ret.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const prevBal = Number(latestWallet?.balance_after || 0);

        await db.from("wallet_ledger").insert({
          user_id: ret.user_id,
          amount_delta: refundAmt,
          balance_after: prevBal + refundAmt,
          entry_type: "credit_refund",
          reference_id: ret.id,
          note: `Refund credited for return ${ret.id.slice(0, 8)}`,
        });
      } else {
        const parentOrderId = (ret.sub_order as any)?.parent_order_id;
        if (parentOrderId) {
          const { data: orderRow } = await db
            .from("orders")
            .select("razorpay_payment_id")
            .eq("id", parentOrderId)
            .maybeSingle();

          const rzp = getRazorpayClient();
          if (rzp && orderRow?.razorpay_payment_id) {
            await rzp
              .createRefund({
                paymentId: orderRow.razorpay_payment_id,
                amountPaise: Math.round(refundAmt * 100),
                notes: { returnId: ret.id },
              })
              .catch(() => null);
          }
        }
      }

      await db.from("refunds").insert({
        return_id: ret.id,
        order_id: (ret.sub_order as any)?.parent_order_id || null,
        user_id: ret.user_id,
        amount: refundAmt,
        method: ret.refund_method || "wallet",
        status: "processed",
      });
    }
  }

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: profile.role,
      action: `return.${parsed.data.status}`,
      entityType: "return",
      entityId: ret.id,
    },
    db
  );

  return NextResponse.json({ returnRequest: updated });
}

