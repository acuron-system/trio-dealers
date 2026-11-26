import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { recordAuditLog } from "@/lib/security/audit";

const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20).optional().nullable(),
    email: z.string().email().max(255),
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(5).max(2000),
    turnstileToken: z.string().max(4096).optional().nullable(),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("contact", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many inquiries submitted. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid inquiry form values." },
      { status: 400 }
    );
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json(
      { error: turnstile.error || "Human verification failed." },
      { status: 400 }
    );
  }

  if (isSupabaseConfigured()) {
    const adminClient = createAdminClient();
    await recordAuditLog(
      {
        request,
        actorRole: "visitor",
        action: "contact.inquiry.submitted",
        entityType: "contact_inquiry",
        details: {
          name: parsed.data.name,
          email: parsed.data.email,
          subject: parsed.data.subject,
          ip,
          userAgent,
        },
      },
      adminClient || undefined
    );
  }

  await sendTransactionalEmail({
    to: process.env.CONTACT_RECEIVER_EMAIL || process.env.EMAIL_FROM || "orders@triodealers.in",
    subject: `[Contact Inquiry] ${parsed.data.subject}`,
    html: `<p><strong>From:</strong> ${parsed.data.name} (${parsed.data.email})</p><p><strong>Phone:</strong> ${parsed.data.phone || "N/A"}</p><p>${parsed.data.message}</p>`,
  });

  return NextResponse.json({
    ok: true,
    message: "Your inquiry has been logged and sent to our trade desk.",
  });
}

