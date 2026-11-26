import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";

const resetSchema = z
  .object({
    email: z.string().email().max(255),
    turnstileToken: z.string().max(4096).optional().nullable(),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database connection not configured." }, { status: 503 });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("password_reset", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: turnstile.error || "Bot verification failed." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Dispatch reset email without leaking whether the account exists
  await supabase.auth
    .resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })
    .catch(() => null);

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email address, password recovery instructions have been dispatched.",
  });
}
