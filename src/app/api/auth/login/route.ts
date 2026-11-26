import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

const loginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(200),
    turnstileToken: z.string().max(4096).optional().nullable(),
    totpCode: z.string().max(12).optional().nullable(),
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format." }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  // Enforce IP rate limit + per-email progressive lockout (5 consecutive failures in 15 min)
  const ipLimit = await checkRateLimit("auth_login", ip);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const accountLock = await checkRateLimit("auth_login", `email:${normalizedEmail}`, {
    requests: 8,
    windowSeconds: 900,
  });
  if (!accountLock.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts for this account. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: turnstile.error || "Bot verification failed." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await recordAuditLog({
      request,
      actorId: null,
      actorRole: "anonymous",
      action: "auth.login.failed",
      entityType: "auth_session",
      details: { email: normalizedEmail, ip, userAgent },
    });
    // Non-enumerating error message regardless of failure reason
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("id", data.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Unable to sign in with this account. Please contact support." },
      { status: 403 }
    );
  }

  // Verify TOTP MFA if user has verified TOTP factors enrolled
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const code = parsed.data.totpCode?.trim();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f) => f.status === "verified");

    if (totpFactor) {
      if (!code) {
        return NextResponse.json({
          mfaRequired: true,
          factorId: totpFactor.id,
          role: profile.role,
          message: "Enter your 6-digit authenticator code to complete sign-in.",
        });
      }

      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code,
      });

      if (verifyErr) {
        return NextResponse.json(
          { error: "Invalid authenticator code.", mfaRequired: true, factorId: totpFactor.id },
          { status: 401 }
        );
      }
    }
  }

  await recordAuditLog({
    request,
    actorId: data.user.id,
    actorRole: profile.role,
    action: "auth.login.success",
    entityType: "auth_session",
    entityId: data.user.id,
    details: { ip, userAgent },
  });

  return NextResponse.json({
    ok: true,
    mfaRequired: false,
    role: profile.role,
    userId: data.user.id,
  });
}
