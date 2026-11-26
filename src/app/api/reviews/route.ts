import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const reviewSchema = z
  .object({
    productId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(2).max(140),
    comment: z.string().trim().min(5).max(1500),
    mediaUrls: z.array(z.string().url()).max(4).optional(),
    turnstileToken: z.string().max(4096).optional().nullable(),
  })
  .strict();

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
    return NextResponse.json({ error: "Sign in to submit a review." }, { status: 401 });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("review", `rev:${user.id}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid review payload." },
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

  const adminClient = createAdminClient();
  const db = adminClient || supabase;

  // Verify whether user genuinely purchased this product
  const { data: purchaseMatch } = await db
    .from("order_items")
    .select("id, sub_order:sub_orders!inner(parent_order:orders!inner(user_id))")
    .eq("product_id", parsed.data.productId)
    .eq("sub_order.parent_order.user_id", user.id)
    .limit(1);

  const isVerifiedPurchase = Boolean(purchaseMatch && purchaseMatch.length > 0);

  const { data: review, error } = await db
    .from("reviews")
    .insert({
      product_id: parsed.data.productId,
      user_id: user.id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      comment: parsed.data.comment,
      is_verified_purchase: isVerifiedPurchase,
    })
    .select("*, user:profiles(id, full_name, role, is_active, phone, created_at)")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("duplicate")
          ? "You have already reviewed this product."
          : error.message,
      },
      { status: 400 }
    );
  }

  if (parsed.data.mediaUrls && parsed.data.mediaUrls.length > 0) {
    await db
      .from("review_media")
      .insert(
        parsed.data.mediaUrls.map((url) => ({
          review_id: review.id,
          url,
        }))
      )
      .then(() => null, () => null);
  }

  return NextResponse.json({ review }, { status: 201 });
}

