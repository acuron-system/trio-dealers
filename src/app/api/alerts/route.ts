import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";

const actionSchema = z
  .object({
    type: z.enum(["price_alert", "stock_alert", "follow_shop", "view_product"]),
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    shopId: z.string().uuid().optional(),
    targetPrice: z.number().positive().optional(),
  })
  .strict();

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

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { type, productId, variantId, shopId, targetPrice } = parsed.data;

  if (type === "view_product" && productId) {
    await supabase
      .from("recently_viewed")
      .upsert(
        {
          user_id: user.id,
          product_id: productId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product_id" }
      )
      .then(() => null, () => null);
    return NextResponse.json({ ok: true });
  }

  if (type === "price_alert" && productId) {
    await supabase
      .from("price_alerts")
      .upsert(
        {
          user_id: user.id,
          product_id: productId,
          target_price: targetPrice ?? null,
          is_active: true,
        },
        { onConflict: "user_id,product_id" }
      );
    return NextResponse.json({ subscribed: true, message: "Price-drop alert enabled." });
  }

  if (type === "stock_alert" && variantId) {
    await supabase
      .from("stock_alerts")
      .upsert(
        {
          user_id: user.id,
          variant_id: variantId,
          is_active: true,
        },
        { onConflict: "user_id,variant_id" }
      );
    return NextResponse.json({ subscribed: true, message: "Back-in-stock alert enabled." });
  }

  if (type === "follow_shop" && shopId) {
    const { data: existing } = await supabase
      .from("shop_followers")
      .select("id")
      .eq("user_id", user.id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existing) {
      await supabase.from("shop_followers").delete().eq("id", existing.id);
      return NextResponse.json({ following: false });
    }

    await supabase
      .from("shop_followers")
      .insert({ user_id: user.id, shop_id: shopId });
    return NextResponse.json({ following: true });
  }

  return NextResponse.json({ error: "Missing target identifier." }, { status: 400 });
}

