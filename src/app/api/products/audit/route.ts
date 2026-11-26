import { NextResponse } from "next/server";
import { requireProductActor } from "@/lib/product-server";

export async function GET(request: Request) {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  let query = ctx.db
    .from("product_audit_logs")
    .select(
      `
      *,
      actor:profiles(id, full_name, role),
      shop:shops(id, shop_name)
    `
    )
    .order("created_at", { ascending: false })
    .limit(150);

  if (!ctx.isAdmin) {
    if (!ctx.shop) {
      return NextResponse.json({ logs: [] });
    }
    query = query.eq("shop_id", ctx.shop.id);
  }

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}

