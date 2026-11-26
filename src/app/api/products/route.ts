import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchEnrichedProductById,
  generateUniqueSlug,
  notifyAdminsOfSubmission,
  recordProductAuditLog,
  requireProductActor,
  resolveShopIdForAdmin,
  sendNotification,
  syncProductChildren,
} from "@/lib/product-server";
import { ProductPayloadInput, validateProductSubmission } from "@/lib/product-rules";
import { ProductApprovalStatus } from "@/types/database";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ products: [] });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && !profile.is_active) {
      return NextResponse.json({ error: "Account is disabled." }, { status: 403 });
    }
    role = profile?.role || null;
  }

  if (role === "transporter") {
    return NextResponse.json(
      { error: "Transporters do not have access to product catalog management." },
      { status: 403 }
    );
  }

  let query = supabase
    .from("products")
    .select(
      `
      *,
      category:categories(*),
      brand:brands(*),
      size_chart:size_charts(*),
      shop:shops(*),
      variants:product_variants(*),
      images:product_images(*),
      price_slabs(*)
    `
    )
    .order("created_at", { ascending: false });

  if (role === "admin") {
    // Admin sees all products across shops & statuses
  } else if (role === "shop" && user) {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!shop) {
      return NextResponse.json({ products: [] });
    }
    query = query.eq("shop_id", shop.id);
  } else {
    query = query
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .eq("is_archived", false)
      .is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data || [] });
}

export async function POST(request: Request) {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  try {
    const body = await request.json();
    const {
      submitMode = "submit",
      shop_id,
      name,
      slug,
      category_id,
      brand_id,
      size_chart_id,
      fabric,
      fit,
      pattern,
      occasion,
      audience = "unisex",
      description,
      care_instructions,
      video_url,
      hsn_code,
      gst_rate,
      mrp,
      retail_price,
      b2b_moq,
      sell_retail = true,
      sell_b2b = true,
      images = [],
      image_metadata = [],
      variants = [],
      price_slabs = [],
    } = body as ProductPayloadInput & {
      submitMode?: "draft" | "submit" | "publish_now";
    };

    // Determine target status cleanly per role permissions
    let targetStatus: ProductApprovalStatus = "pending";
    let isActive = true;

    if (submitMode === "draft") {
      targetStatus = "draft";
      isActive = false;
    } else if (ctx.isAdmin && submitMode === "publish_now") {
      targetStatus = "approved";
      isActive = true;
    } else {
      targetStatus = "pending";
      isActive = true;
    }

    const normalizedInput: ProductPayloadInput = {
      name: String(name || "").trim(),
      slug: slug ? String(slug).trim() : undefined,
      category_id: category_id || null,
      brand_id: brand_id || null,
      size_chart_id: size_chart_id || null,
      fabric: fabric ? String(fabric).trim() : "",
      fit: fit ? String(fit).trim() : "",
      pattern: pattern ? String(pattern).trim() : "",
      occasion: occasion ? String(occasion).trim() : "",
      audience: audience || "unisex",
      description: description ? String(description).trim() : "",
      care_instructions: care_instructions ? String(care_instructions).trim() : "",
      video_url: video_url ? String(video_url).trim() : "",
      hsn_code: hsn_code ? String(hsn_code).trim() : "",
      gst_rate: Number(gst_rate ?? 0),
      mrp: Number(mrp ?? 0),
      retail_price: Number(retail_price ?? 0),
      b2b_moq: Number(b2b_moq ?? 10),
      sell_retail: Boolean(sell_retail),
      sell_b2b: Boolean(sell_b2b),
      images: Array.isArray(images) ? images.map(String).filter((u) => u.trim()) : [],
      image_metadata: Array.isArray(image_metadata) ? image_metadata : [],
      variants: Array.isArray(variants) ? variants : [],
      price_slabs: Array.isArray(price_slabs) ? price_slabs : [],
    };

    const validation = validateProductSubmission(normalizedInput, targetStatus);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    // Resolve target shop
    let targetShop = ctx.shop;
    if (ctx.isAdmin) {
      const resolved = await resolveShopIdForAdmin(ctx.db, ctx.userId, shop_id);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      targetShop = resolved.shop;
    }

    if (!targetShop) {
      return NextResponse.json({ error: "Target shop is required." }, { status: 400 });
    }

    const uniqueSlug = await generateUniqueSlug(ctx.db, normalizedInput.name, normalizedInput.slug);
    const nowIso = new Date().toISOString();

    const { data: createdRow, error: insertErr } = await ctx.db
      .from("products")
      .insert({
        shop_id: targetShop.id,
        category_id: normalizedInput.category_id || null,
        brand_id: normalizedInput.brand_id || null,
        size_chart_id: normalizedInput.size_chart_id || null,
        name: normalizedInput.name,
        slug: uniqueSlug,
        description: normalizedInput.description || null,
        care_instructions: normalizedInput.care_instructions || null,
        video_url: normalizedInput.video_url || null,
        fabric: normalizedInput.fabric || null,
        fit: normalizedInput.fit || null,
        pattern: normalizedInput.pattern || null,
        occasion: normalizedInput.occasion || null,
        audience: normalizedInput.audience || "unisex",
        hsn_code: normalizedInput.hsn_code || null,
        gst_rate: normalizedInput.gst_rate || 5,
        mrp: normalizedInput.mrp,
        retail_price: normalizedInput.retail_price,
        b2b_moq: normalizedInput.b2b_moq,
        sell_retail: normalizedInput.sell_retail,
        sell_b2b: normalizedInput.sell_b2b,
        approval_status: targetStatus,
        moderation_note: null,
        is_active: isActive,
        is_archived: false,
        submitted_at: targetStatus === "pending" ? nowIso : null,
        approved_at: targetStatus === "approved" ? nowIso : null,
        approved_by: targetStatus === "approved" ? ctx.userId : null,
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (insertErr || !createdRow) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create product." },
        { status: 400 }
      );
    }

    await syncProductChildren(ctx.db, createdRow.id, normalizedInput.name, normalizedInput, ctx.userId, "initial");
    const enriched = await fetchEnrichedProductById(ctx.db, createdRow.id);

    await recordProductAuditLog(ctx.db, {
      productId: createdRow.id,
      productName: normalizedInput.name,
      shopId: targetShop.id,
      actorId: ctx.userId,
      actorRole: ctx.profile.role,
      action: targetStatus === "draft" ? "created" : targetStatus === "approved" ? "approved" : "submitted",
      previousStatus: null,
      newStatus: targetStatus,
      reason:
        ctx.isAdmin && targetShop.owner_id !== ctx.userId
          ? `Added by Admin on behalf of ${targetShop.shop_name}`
          : null,
    });

    if (targetStatus === "pending") {
      await notifyAdminsOfSubmission(ctx.db, {
        productName: normalizedInput.name,
        shopName: targetShop.shop_name,
      });
    } else if (ctx.isAdmin && targetShop.owner_id !== ctx.userId) {
      await sendNotification(ctx.db, {
        userId: targetShop.owner_id,
        title: "Admin Added a Product to Your Shop",
        message: `Trio Dealers Admin added "${normalizedInput.name}" to ${targetShop.shop_name} (status: ${targetStatus}).`,
        linkUrl: "/seller/products",
      });
    }

    return NextResponse.json({ product: enriched }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid request payload." },
      { status: 400 }
    );
  }
}

