import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const sendChatSchema = z
  .object({
    shopId: z.string().uuid(),
    threadId: z.string().uuid().optional(),
    body: z.string().trim().min(1).max(1500),
  })
  .strict();

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ threads: [] });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleScope = searchParams.get("scope") || "buyer";

  if (roleScope === "shop") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!shop) return NextResponse.json({ threads: [] });

    const { data } = await supabase
      .from("chat_threads")
      .select("*, buyer:profiles(full_name), messages:chat_messages(*)")
      .eq("shop_id", shop.id)
      .order("updated_at", { ascending: false });
    return NextResponse.json({ threads: data || [] });
  }

  const { data } = await supabase
    .from("chat_threads")
    .select("*, shop:shops(shop_name, slug), messages:chat_messages(*)")
    .eq("buyer_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json({ threads: data || [] });
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

  const rl = await checkRateLimit("general_api", `chat:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Message rate limit reached." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = sendChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Message text and shopId are required." }, { status: 400 });
  }

  let threadId = parsed.data.threadId;

  if (!threadId) {
    const { data: existing } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("shop_id", parsed.data.shopId)
      .maybeSingle();

    if (existing) {
      threadId = existing.id;
    } else {
      const { data: created, error: tErr } = await supabase
        .from("chat_threads")
        .insert({
          buyer_id: user.id,
          shop_id: parsed.data.shopId,
        })
        .select("id")
        .single();
      if (tErr || !created) {
        return NextResponse.json({ error: tErr?.message || "Failed to start chat." }, { status: 500 });
      }
      threadId = created.id;
    }
  }

  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return NextResponse.json({ threadId, message }, { status: 201 });
}

