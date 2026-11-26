import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

const transitionSchema = z
  .object({
    subOrderId: z.string().uuid(),
    status: z.enum(["accepted", "confirmed", "packed", "ready_for_pickup"]),
    note: z.string().trim().max(300).optional(),
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

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status transition payload." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const [{ data: profile }, { data: subOrder }] = await Promise.all([
    db.from("profiles").select("role, is_active").eq("id", user.id).single(),
    db
      .from("sub_orders")
      .select("id, shop_id, status, shop:shops(owner_id)")
      .eq("id", parsed.data.subOrderId)
      .single(),
  ]);

  if (!profile || !profile.is_active || !subOrder) {
    return NextResponse.json({ error: "Sub-order not found." }, { status: 404 });
  }

  const isOwner = (subOrder.shop as any)?.owner_id === user.id;
  if (profile.role !== "admin" && !isOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: updated, error } = await db
    .from("sub_orders")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", subOrder.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("order_status_history").insert({
    sub_order_id: subOrder.id,
    status: parsed.data.status,
    note: parsed.data.note || `Updated to ${parsed.data.status} by ${profile.role}`,
    changed_by: user.id,
  });

  await recordAuditLog(
    {
      request,
      actorId: user.id,
      actorRole: profile.role,
      action: "sub_order.status_update",
      entityType: "sub_order",
      entityId: subOrder.id,
      details: { from: subOrder.status, to: parsed.data.status },
    },
    db
  );

  return NextResponse.json({ subOrder: updated });
}

