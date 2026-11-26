import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestAuditMeta } from "@/lib/security/csrf";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ products: [], trending: [] });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("search", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Search rate limit reached. Please pause briefly." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const category = (searchParams.get("category") || "").trim();
  const audience = (searchParams.get("audience") || "").trim();
  const sort = (searchParams.get("sort") || "newest").trim();
  const b2bOnly = searchParams.get("b2b") === "1" || searchParams.get("b2b") === "true";
  const maxPrice = Number(searchParams.get("maxPrice") || 0);

  const supabase = createClient();

  let query = supabase
    .from("products")
    .select(
      `
      *,
      shop:shops!inner(id, shop_name, slug, city, state, kyc_status, is_suspended),
      category:categories(id, name, slug, parent_id),
      brand:brands(id, name, slug),
      images:product_images(*),
      variants:product_variants(*),
      price_slabs:price_slabs(*)
    `
    )
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.kyc_status", "approved")
    .eq("shop.is_suspended", false);

  if (q) {
    const safeQ = q.replace(/[%_]/g, "");
    query = query.or(
      `name.ilike.%${safeQ}%,fabric.ilike.%${safeQ}%,pattern.ilike.%${safeQ}%,occasion.ilike.%${safeQ}%,hsn_code.ilike.%${safeQ}%`
    );
  }

  if (category && category !== "all") {
    const { data: matchedCat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .maybeSingle();
    if (matchedCat) {
      const { data: children } = await supabase
        .from("categories")
        .select("id")
        .eq("parent_id", matchedCat.id);
      const ids = [matchedCat.id, ...(children || []).map((c: any) => c.id)];
      query = query.in("category_id", ids);
    }
  }

  if (audience && audience !== "all") {
    query = query.eq("audience", audience);
  }

  if (b2bOnly) {
    query = query.eq("sell_b2b", true);
  }

  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    query = query.lte("retail_price", maxPrice);
  }

  if (sort === "price_asc") {
    query = query.order("retail_price", { ascending: true });
  } else if (sort === "price_desc") {
    query = query.order("retail_price", { ascending: false });
  } else if (sort === "name_asc") {
    query = query.order("name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: products, error } = await query.limit(48);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Derive trending keywords dynamically from active categories & distinct fabrics
  const trending = Array.from(
    new Set(
      (products || [])
        .map((p: any) => p.fabric)
        .filter((f: unknown): f is string => typeof f === "string" && f.length > 0)
    )
  ).slice(0, 6);

  return NextResponse.json({
    products: products || [],
    trending,
    total: (products || []).length,
  });
}

