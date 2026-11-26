import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const createTicketSchema = z
  .object({
    subject: z.string().trim().min(4).max(160),
    category: z.enum(["order", "payment", "return", "b2b", "seller", "general"]).default("general"),
    message: z.string().trim().min(5).max(2000),
    orderId: z.string().uuid().optional().nullable(),
  })
  .strict();

const replyTicketSchema = z
  .object({
    ticketId: z.string().uuid(),
    message: z.string().trim().min(2).max(2000),
    status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  })
  .strict();

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ tickets: [] });
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

  const db = profile?.role === "admin" ? createAdminClient() || supabase : supabase;
  let query = db
    .from("support_tickets")
    .select("*, messages:ticket_messages(*)")
    .order("updated_at", { ascending: false });

  if (profile?.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const { data } = await query;
  return NextResponse.json({ tickets: data || [] });
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
    return NextResponse.json({ error: "Sign in to submit a support ticket." }, { status: 401 });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("contact", `ticket:${user.id}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many support submissions." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid ticket payload." }, { status: 400 });
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      order_id: parsed.data.orderId || null,
      status: "open",
    })
    .select("*")
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: error?.message || "Failed to open ticket." }, { status: 500 });
  }

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    body: parsed.data.message,
  });

  return NextResponse.json({ ticket }, { status: 201 });
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

  const parsed = replyTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticket reply." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const db = profile?.role === "admin" ? createAdminClient() || supabase : supabase;
  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, user_id")
    .eq("id", parsed.data.ticketId)
    .single();

  if (!ticket || (profile?.role !== "admin" && ticket.user_id !== user.id)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await db.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    body: parsed.data.message,
  });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (parsed.data.status && profile?.role === "admin") {
    updates.status = parsed.data.status;
  }

  const { data: updated } = await db
    .from("support_tickets")
    .update(updates)
    .eq("id", ticket.id)
    .select("*, messages:ticket_messages(*)")
    .single();

  return NextResponse.json({ ticket: updated });
}

