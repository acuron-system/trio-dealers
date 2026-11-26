import { NextResponse } from "next/server";
import { requireProductActor } from "@/lib/product-server";

export async function GET() {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  let query = ctx.db
    .from("stock_movements")
    .select(
      `
      *,
      actor:profiles(id, full_name, role),
      variant:product_variants(
        id, size, color, sku, stock_qty,
        product:products(id, name, slug, shop_id)
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(120);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).filter((m: any) => {
    if (ctx.isAdmin) return true;
    const prod = Array.isArray(m.variant?.product) ? m.variant?.product[0] : m.variant?.product;
    return prod?.shop_id && prod.shop_id === ctx.shop?.id;
  });

  return NextResponse.json({ movements: rows });
}

export async function POST(request: Request) {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  try {
    const body = await request.json();
    const variantId = String(body.variant_id || "");
    const nextQty = Number(body.stock_qty);
    const reason = String(body.reason || "manual_adjust");
    const note = String(body.note || "").trim();

    if (!variantId || !Number.isInteger(nextQty) || nextQty < 0) {
      return NextResponse.json(
        { error: "Valid variant_id and non-negative integer stock_qty are required." },
        { status: 400 }
      );
    }

    const allowedReasons = ["manual_adjust", "manual_restock", "return_restock"];
    const safeReason = allowedReasons.includes(reason) ? reason : "manual_adjust";

    const { data: variant, error: varErr } = await ctx.db
      .from("product_variants")
      .select("*, product:products(id, name, shop_id)")
      .eq("id", variantId)
      .single();

    if (varErr || !variant) {
      return NextResponse.json({ error: "Product variant not found." }, { status: 404 });
    }

    const prod = Array.isArray((variant as any).product)
      ? (variant as any).product[0]
      : (variant as any).product;

    if (!ctx.isAdmin && (!prod || prod.shop_id !== ctx.shop?.id)) {
      return NextResponse.json(
        { error: "You can only adjust stock for your own shop's variants." },
        { status: 403 }
      );
    }

    const prevQty = Number(variant.stock_qty || 0);
    const delta = nextQty - prevQty;

    const { error: updErr } = await ctx.db
      .from("product_variants")
      .update({ stock_qty: nextQty })
      .eq("id", variantId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    let movement = null;
    if (delta !== 0) {
      const { data: mov } = await ctx.db
        .from("stock_movements")
        .insert({
          variant_id: variantId,
          change_qty: delta,
          reason: safeReason,
          note: note || `Adjusted stock from ${prevQty} to ${nextQty}`,
          created_by: ctx.userId,
        })
        .select("*, actor:profiles(id, full_name, role)")
        .single();
      movement = mov;
    }

    return NextResponse.json({
      variant: { ...variant, stock_qty: nextQty },
      movement,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update stock." },
      { status: 400 }
    );
  }
}

