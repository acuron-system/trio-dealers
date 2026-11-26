import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { validatePasswordStrength } from "@/lib/security/password";
import { encryptSensitiveField } from "@/lib/security/crypto";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

const baseRegisterSchema = z
  .object({
    accountType: z.enum(["user", "shop", "b2b"]).default("user"),
    email: z.string().email().max(255),
    password: z.string().min(10).max(128),
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(20).optional().nullable(),
    turnstileToken: z.string().max(4096).optional().nullable(),
    shop_name: z.string().trim().max(160).optional(),
    business_name: z.string().trim().max(160).optional(),
    gstin: z.string().trim().max(20).optional(),
    pan: z.string().trim().max(16).optional(),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    pincode: z.string().trim().max(12).optional(),
    bank_name: z.string().trim().max(120).optional(),
    bank_account_no: z.string().trim().max(64).optional(),
    bank_ifsc: z.string().trim().max(20).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database connection is not configured." },
      { status: 503 }
    );
  }

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("auth_signup", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const parsed = baseRegisterSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid registration details." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const pwdCheck = validatePasswordStrength(data.password);
  if (!pwdCheck.valid) {
    return NextResponse.json({ error: pwdCheck.error }, { status: 400 });
  }

  const turnstile = await verifyTurnstileToken(data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: turnstile.error || "Bot verification failed." },
      { status: 400 }
    );
  }

  if (data.accountType === "shop" && (!data.shop_name || !data.address || !data.phone)) {
    return NextResponse.json(
      { error: "Shop name, phone, and warehouse address are required for seller registration." },
      { status: 400 }
    );
  }

  if (data.accountType === "b2b" && (!data.business_name || !data.gstin || !data.address || !data.phone)) {
    return NextResponse.json(
      { error: "Business name, GSTIN, phone, and address are required for B2B registration." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const userMetadata: Record<string, unknown> = {
    full_name: data.full_name,
    phone: data.phone || null,
    role: data.accountType,
  };

  if (data.accountType === "shop") {
    Object.assign(userMetadata, {
      shop_name: data.shop_name,
      gstin: data.gstin?.toUpperCase() || "",
      pan: data.pan?.toUpperCase() || "",
      address: data.address,
      city: data.city || "Surat",
      state: data.state || "Gujarat",
      pincode: data.pincode || "395002",
      bank_name: data.bank_name || "Pending",
      bank_account_no: data.bank_account_no || "Pending",
      bank_ifsc: data.bank_ifsc?.toUpperCase() || "Pending",
    });
  } else if (data.accountType === "b2b") {
    Object.assign(userMetadata, {
      business_name: data.business_name,
      gstin: data.gstin?.toUpperCase(),
      pan: data.pan?.toUpperCase() || "",
      address: data.address,
      city: data.city || "Mumbai",
      state: data.state || "Maharashtra",
      pincode: data.pincode || "400001",
    });
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: userMetadata,
    },
  });

  if (error) {
    // Non-enumerating friendly error
    return NextResponse.json(
      { error: "Unable to complete registration. Please check your details or sign in if you already have an account." },
      { status: 400 }
    );
  }

  // Encrypt sensitive bank & tax numbers at rest when service role is available
  const adminClient = createAdminClient();
  if (adminClient && authData.user) {
    await adminClient
      .from("profiles")
      .update({ dpdp_consent_at: new Date().toISOString() })
      .eq("id", authData.user.id)
      .then(() => null, () => null);

    if (data.accountType === "shop" && (data.bank_account_no || data.pan)) {
      await adminClient
        .from("shops")
        .update({
          bank_account_no: encryptSensitiveField(data.bank_account_no) || undefined,
          pan: encryptSensitiveField(data.pan?.toUpperCase()) || undefined,
        })
        .eq("owner_id", authData.user.id)
        .then(() => null, () => null);
    } else if (data.accountType === "b2b" && data.pan) {
      await adminClient
        .from("b2b_accounts")
        .update({
          pan: encryptSensitiveField(data.pan.toUpperCase()) || undefined,
        })
        .eq("user_id", authData.user.id)
        .then(() => null, () => null);
    }

    await recordAuditLog(
      {
        request,
        actorId: authData.user.id,
        actorRole: data.accountType,
        action: `auth.register.${data.accountType}`,
        entityType: "profile",
        entityId: authData.user.id,
        details: { ip, userAgent },
      },
      adminClient
    );
  }

  return NextResponse.json({
    ok: true,
    role: data.accountType,
    needsEmailConfirmation: !authData.session,
  });
}
