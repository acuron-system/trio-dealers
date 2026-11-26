import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/lib/security/audit";

const deletionSchema = z
  .object({
    requestType: z.enum(["export", "delete"]).default("delete"),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET() {
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

  const [profileRes, ordersRes, addressesRes, reviewsRes, loyaltyRes, walletRes, dpdpRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("orders")
        .select("id, order_number, status, total_amount, payment_method, payment_status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("addresses").select("*").eq("user_id", user.id),
      supabase.from("reviews").select("*").eq("user_id", user.id),
      supabase.from("loyalty_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("wallet_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("dpdp_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

  await recordAuditLog({
    actorId: user.id,
    actorRole: profileRes.data?.role || "user",
    action: "dpdp.data_export",
    entityType: "profile",
    entityId: user.id,
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      profile: profileRes.data || null,
    },
    addresses: addressesRes.data || [],
    orders: ordersRes.data || [],
    reviews: reviewsRes.data || [],
    loyaltyLedger: loyaltyRes.data || [],
    walletLedger: walletRes.data || [],
    privacyRequests: dpdpRes.data || [],
  });
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

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("general_api", `dpdp:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many privacy requests. Please try later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request JSON." }, { status: 400 });
  }

  const parsed = deletionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid privacy request payload." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  const { data: reqRecord, error } = await db
    .from("dpdp_requests")
    .insert({
      user_id: user.id,
      request_type: parsed.data.requestType,
      status: parsed.data.requestType === "export" ? "completed" : "pending",
      reason: parsed.data.reason || null,
      processed_at: parsed.data.requestType === "export" ? new Date().toISOString() : null,
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
      action: `dpdp.request.${parsed.data.requestType}`,
      entityType: "dpdp_request",
      entityId: reqRecord.id,
      details: { reason: parsed.data.reason || null, ip, userAgent },
    },
    db
  );

  return NextResponse.json(
    {
      request: reqRecord,
      message:
        parsed.data.requestType === "delete"
          ? "Your account deletion/anonymization request under the DPDP Act has been logged for compliance processing while preserving statutory GST invoices."
          : "Export recorded.",
    },
    { status: 201 }
  );
}
