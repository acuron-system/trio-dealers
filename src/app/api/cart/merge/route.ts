import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";

const mergeSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            variantId: z.string().uuid(),
            quantity: z.number().int().min(1).max(10000),
          })
          .strict()
      )
      .max(100),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [] });
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

  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });
  }

  // Upsert / accumulate guest cart quantities into DB cart_items table
  for (const guestItem of parsed.data.items) {
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("variant_id", guestItem.variantId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + guestItem.quantity })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("cart_items")
        .insert({
          user_id: user.id,
          product_id: guestItem.productId,
          variant_id: guestItem.variantId,
          quantity: guestItem.quantity,
        })
        .then(() => null, () => null);
    }
  }

  const { data: mergedRows } = await supabase
    .from("cart_items")
    .select(
      `
      id, quantity,
      product:products!inner(
        *,
        shop:shops!inner(id, shop_name, slug, city, state, kyc_status, is_suspended),
        images:product_images(*),
        variants:product_variants(*),
        price_slabs:price_slabs(*)
      ),
      variant:product_variants!inner(*)
    `
    )
    .eq("user_id", user.id);

  return NextResponse.json({ items: mergedRows || [] });
}

