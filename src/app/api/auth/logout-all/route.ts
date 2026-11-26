import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { ip, userAgent } = getRequestAuditMeta(request);
    await recordAuditLog({
      request,
      actorId: user.id,
      actorRole: "user",
      action: "auth.logout_all",
      entityType: "auth_session",
      entityId: user.id,
      details: { ip, userAgent },
    });
  }

  await supabase.auth.signOut({ scope: "global" });

  return NextResponse.json({ ok: true });
}
