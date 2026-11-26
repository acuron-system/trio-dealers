import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validatePasswordStrength } from "@/lib/security/password";
import { maskTaxId } from "@/lib/security/crypto";
import { recordAuditLog } from "@/lib/security/audit";

const createUserSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(10).max(128),
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(20).optional().nullable(),
    role: z.enum(["user", "shop", "b2b", "transporter", "admin"]).default("transporter"),
  })
  .strict();

const patchUserSchema = z
  .object({
    id: z.string().uuid(),
    is_active: z.boolean().optional(),
    role: z.enum(["user", "shop", "b2b", "transporter", "admin"]).optional(),
  })
  .strict();

async function requireAdmin(enforceMfa = true) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured in .env.local", status: 503 as const };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required", status: 401 as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return { error: "Admin access required", status: 403 as const };
  }

  if (enforceMfa) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      return {
        error: "Admin 2FA verification required for sensitive operations.",
        status: 403 as const,
      };
    }
  }

  return { user, supabase };
}

export async function GET() {
  const auth = await requireAdmin(false);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = createAdminClient();
  const client = adminClient || auth.supabase;

  const { data: profiles, error } = await client
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [{ data: shops }, { data: b2bs }] = await Promise.all([
    client.from("shops").select("owner_id, shop_name, kyc_status, gstin"),
    client
      .from("b2b_accounts")
      .select("user_id, business_name, verification_status, gstin, credit_balance"),
  ]);

  const shopByOwner = new Map((shops || []).map((s: any) => [s.owner_id, s]));
  const b2bByUser = new Map((b2bs || []).map((b: any) => [b.user_id, b]));

  const enriched = (profiles || []).map((p: any) => {
    const shop = shopByOwner.get(p.id);
    const b2b = b2bByUser.get(p.id);
    const rawTax = shop?.gstin || b2b?.gstin || null;
    return {
      ...p,
      shop_name: shop?.shop_name || b2b?.business_name || null,
      gst_no: rawTax ? maskTaxId(rawTax) : null,
      credit_balance: b2b?.credit_balance ?? 0,
      is_approved:
        p.role === "shop"
          ? shop?.kyc_status === "approved"
          : p.role === "b2b"
          ? b2b?.verification_status === "approved"
          : p.is_active,
      disabled: !p.is_active,
    };
  });

  return NextResponse.json({ users: enriched });
}

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const auth = await requireAdmin(true);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("general_api", `admin-users:${auth.user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required in .env.local to create user accounts server-side.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid user fields." },
      { status: 400 }
    );
  }

  const pwdCheck = validatePasswordStrength(parsed.data.password);
  if (!pwdCheck.valid) {
    return NextResponse.json({ error: pwdCheck.error }, { status: 400 });
  }

  const { email, password, full_name, phone, role } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      phone: phone || null,
      role,
    },
  });

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create auth user." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .upsert(
      {
        id: createdUser.user.id,
        full_name,
        phone: phone || null,
        role,
        is_active: true,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  await recordAuditLog(
    {
      request,
      actorId: auth.user.id,
      actorRole: "admin",
      action: "admin.user.create",
      entityType: "profile",
      entityId: createdUser.user.id,
      details: { role, full_name, ip, userAgent },
    },
    adminClient
  );

  return NextResponse.json(
    { user: { ...profile, email: normalizedEmail, is_approved: true, disabled: false } },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const auth = await requireAdmin(true);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ip, userAgent } = getRequestAuditMeta(request);
  const adminClient = createAdminClient();
  const client = adminClient || auth.supabase;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid user update payload." },
      { status: 400 }
    );
  }

  const { id, is_active, role } = parsed.data;
  const { data: oldProfile } = await client
    .from("profiles")
    .select("role, is_active")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (role) updates.role = role;

  const { data, error } = await client
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (adminClient && typeof is_active === "boolean") {
    await adminClient.auth.admin.updateUserById(id, {
      ban_duration: is_active ? "none" : "876000h",
    });
  }

  await recordAuditLog(
    {
      request,
      actorId: auth.user.id,
      actorRole: "admin",
      action: "admin.user.update",
      entityType: "profile",
      entityId: id,
      details: {
        oldValues: oldProfile || null,
        newValues: updates,
        ip,
        userAgent,
      },
    },
    adminClient || undefined
  );

  return NextResponse.json({ user: { ...data, disabled: !data.is_active } });
}
