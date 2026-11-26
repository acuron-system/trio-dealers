import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const askSchema = z
  .object({
    productId: z.string().uuid(),
    question: z.string().trim().min(5).max(500),
  })
  .strict();

const answerSchema = z
  .object({
    questionId: z.string().uuid(),
    answer: z.string().trim().min(2).max(1000),
  })
  .strict();

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ questions: [] });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId required." }, { status: 400 });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("product_questions")
    .select("*, user:profiles!product_questions_user_id_fkey(full_name)")
    .eq("product_id", productId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ questions: data || [] });
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
    return NextResponse.json({ error: "Sign in to ask a question." }, { status: 401 });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("review", `qa:${user.id}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many questions submitted. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a question between 5 and 500 characters." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("product_questions")
    .insert({
      product_id: parsed.data.productId,
      user_id: user.id,
      question: parsed.data.question,
      is_published: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question: data }, { status: 201 });
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "shop"].includes(profile.role)) {
    return NextResponse.json({ error: "Only sellers or admin can answer Q&A." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid answer." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("product_questions")
    .update({
      answer: parsed.data.answer,
      answered_by: user.id,
      answered_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.questionId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question: data });
}

