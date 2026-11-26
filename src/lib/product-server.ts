import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProductPayloadInput, ProductSlabInput, ProductVariantInput, slugifyProductName } from "./product-rules";
import { Product, ProductAuditAction, Profile, Shop, UserRole } from "@/types/database";

export interface ProductActorContext {
  userId: string;
  profile: Profile;
  shop: Shop | null;
  isAdmin: boolean;
  db: SupabaseClient;
  userClient: SupabaseClient;
}

export async function requireProductActor(): Promise<
  { error: NextResponse } | { ctx: ProductActorContext }
> {
  if (!isSupabaseConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured in .env.local." },
        { status: 503 }
      ),
    };
  }

  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const adminClient = createAdminClient();
  const db = adminClient || userClient;

  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profErr || !profile || !profile.is_active) {
    return {
      error: NextResponse.json({ error: "Account is inactive or unavailable." }, { status: 403 }),
    };
  }

  const role = profile.role as UserRole;
  if (role !== "admin" && role !== "shop") {
    return {
      error: NextResponse.json(
        { error: "Only approved Seller Shops and Administrators can manage products." },
        { status: 403 }
      ),
    };
  }

  let shop: Shop | null = null;
  const { data: shopRow } = await db
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  shop = (shopRow as Shop) || null;

  if (role === "shop") {
    if (!shop) {
      return {
        error: NextResponse.json(
          { error: "No shop storefront is registered for your account." },
          { status: 403 }
        ),
      };
    }
    if (shop.kyc_status !== "approved") {
      return {
        error: NextResponse.json(
          {
            error: `Only approved shops can add or edit products. Current shop status: ${shop.kyc_status.toUpperCase()}.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    ctx: {
      userId: user.id,
      profile: profile as Profile,
      shop,
      isAdmin: role === "admin",
      db,
      userClient,
    },
  };
}

export async function resolveShopIdForAdmin(
  db: SupabaseClient,
  adminUserId: string,
  requestedShopId?: string
): Promise<{ shop: Shop } | { error: string }> {
  if (requestedShopId && requestedShopId !== "house") {
    const { data: existingShop } = await db
      .from("shops")
      .select("*")
      .eq("id", requestedShopId)
      .maybeSingle();
    if (!existingShop) {
      return { error: "Selected shop could not be found." };
    }
    if (existingShop.kyc_status !== "approved") {
      return {
        error: `Selected shop "${existingShop.shop_name}" is ${existingShop.kyc_status}. Only approved shops can list products.`,
      };
    }
    return { shop: existingShop as Shop };
  }

  // Reuse or create Trio Dealers House Stock storefront
  const { data: houseShop } = await db
    .from("shops")
    .select("*")
    .or("slug.eq.trio-dealers-house,slug.like.trio-house-%")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (houseShop) {
    return { shop: houseShop as Shop };
  }

  const { data: anyOwnedHouse } = await db
    .from("shops")
    .select("*")
    .eq("owner_id", adminUserId)
    .limit(1)
    .maybeSingle();

  if (anyOwnedHouse) {
    return { shop: anyOwnedHouse as Shop };
  }

  const { data: createdHouse, error: houseErr } = await db
    .from("shops")
    .insert({
      owner_id: adminUserId,
      shop_name: "Trio Dealers Own Stock",
      slug: "trio-dealers-house",
      address_line1: "Trio Dealers Central Atelier, Millennium Textile Market",
      city: "Surat",
      state: "Gujarat",
      pincode: "395002",
      bank_name: "HDFC Bank Ltd",
      bank_account_no: "50200012345678",
      bank_ifsc: "HDFC0001234",
      kyc_status: "approved",
      commission_rate: 0,
    })
    .select("*")
    .single();

  if (houseErr || !createdHouse) {
    return { error: houseErr?.message || "Failed to initialize Trio Dealers house stock shop." };
  }

  return { shop: createdHouse as Shop };
}

export async function generateUniqueSlug(db: SupabaseClient, name: string, requestedSlug?: string): Promise<string> {
  const base = slugifyProductName(requestedSlug?.trim() || name);
  const { data: conflict } = await db
    .from("products")
    .select("id")
    .eq("slug", base)
    .maybeSingle();

  if (!conflict) return base;
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function generateUniqueSku(name: string, index: number): string {
  const prefix = slugifyProductName(name).replace(/-/g, "").slice(0, 4).toUpperCase() || "TEXT";
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `TD-${prefix}-${index + 1}-${rand}`;
}

export async function syncProductChildren(
  db: SupabaseClient,
  productId: string,
  productName: string,
  input: Pick<ProductPayloadInput, "images" | "image_metadata" | "variants" | "price_slabs" | "sell_b2b">,
  actorId?: string,
  stockReason: "initial" | "import" | "manual_adjust" = "initial"
) {
  // 1. Ordered images (index 0 = cover image)
  const cleanImages = (input.images || []).map((u) => u.trim()).filter(Boolean);
  const metaMap = new Map(
    (input.image_metadata || []).map((m) => [m.url.trim(), m])
  );
  await db.from("product_images").delete().eq("product_id", productId);
  if (cleanImages.length > 0) {
    await db.from("product_images").insert(
      cleanImages.map((url, idx) => {
        const meta = metaMap.get(url);
        return {
          product_id: productId,
          url,
          variant_color: meta?.variant_color?.trim() || null,
          alt_text: meta?.alt_text?.trim() || `${productName} image ${idx + 1}`,
          sort_order: idx + 1,
          is_cover: idx === 0,
        };
      })
    );
  }

  // 2. Price slabs
  await db.from("price_slabs").delete().eq("product_id", productId);
  const cleanSlabs = (input.price_slabs || []).filter(
    (s: ProductSlabInput) => Number(s.min_qty) > 0 && Number(s.unit_price) > 0
  );
  if (input.sell_b2b && cleanSlabs.length > 0) {
    const slabMap = new Map<number, number>();
    cleanSlabs.forEach((s) => slabMap.set(Number(s.min_qty), Number(s.unit_price)));
    await db.from("price_slabs").insert(
      Array.from(slabMap.entries()).map(([min_qty, unit_price]) => ({
        product_id: productId,
        min_qty,
        unit_price,
      }))
    );
  }

  // 3. Variants (preserve existing variant IDs linked to order_items & track stock movements)
  const { data: existingVariants } = await db
    .from("product_variants")
    .select("*")
    .eq("product_id", productId);

  const existingList = existingVariants || [];
  const keptIds = new Set<string>();

  for (let i = 0; i < input.variants.length; i++) {
    const incoming: ProductVariantInput = input.variants[i];
    const cleanSku = incoming.sku?.trim() || generateUniqueSku(productName, i);
    const nextQty = Math.max(0, Number(incoming.stock_qty) || 0);
    const lowThresh = Math.max(0, Number(incoming.low_stock_threshold ?? 10));
    const matched = existingList.find(
      (ev: any) =>
        (incoming.id && ev.id === incoming.id) ||
        (incoming.sku?.trim() && ev.sku === incoming.sku.trim())
    );

    if (matched) {
      keptIds.add(matched.id);
      const delta = nextQty - Number(matched.stock_qty || 0);
      await db
        .from("product_variants")
        .update({
          size: incoming.size.trim(),
          color: incoming.color.trim(),
          color_hex: incoming.color_hex?.trim() || matched.color_hex || null,
          sku: cleanSku,
          stock_qty: nextQty,
          low_stock_threshold: lowThresh,
          is_active: incoming.is_active ?? true,
        })
        .eq("id", matched.id);

      if (delta !== 0) {
        await db.from("stock_movements").insert({
          variant_id: matched.id,
          change_qty: delta,
          reason: "manual_adjust",
          note: "Updated via product edit",
          created_by: actorId || null,
        });
      }
    } else {
      const { data: inserted } = await db
        .from("product_variants")
        .insert({
          product_id: productId,
          size: incoming.size.trim(),
          color: incoming.color.trim(),
          color_hex: incoming.color_hex?.trim() || null,
          sku: cleanSku,
          stock_qty: nextQty,
          low_stock_threshold: lowThresh,
          is_active: incoming.is_active ?? true,
        })
        .select("id")
        .single();
      if (inserted?.id) {
        keptIds.add(inserted.id);
        if (nextQty > 0) {
          await db.from("stock_movements").insert({
            variant_id: inserted.id,
            change_qty: nextQty,
            reason: stockReason,
            note: stockReason === "import" ? "Bulk CSV initial stock" : "Initial stock on product create",
            created_by: actorId || null,
          });
        }
      }
    }
  }

  // Remove dropped variants unless referenced by order_items (zero out stock instead)
  const removed = existingList.filter((ev: any) => !keptIds.has(ev.id));
  for (const oldVar of removed) {
    const { count } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", oldVar.id);
    if ((count || 0) > 0) {
      await db.from("product_variants").update({ stock_qty: 0, is_active: false }).eq("id", oldVar.id);
    } else {
      await db.from("product_variants").delete().eq("id", oldVar.id);
    }
  }
}

export async function getProductHistoryStats(db: SupabaseClient, productId: string) {
  const { data: variants } = await db
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  const variantIds = (variants || []).map((v: any) => v.id);

  let orderItemsCount = 0;
  const { count: byProductCount } = await db
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  orderItemsCount += byProductCount || 0;

  if (variantIds.length > 0) {
    const { count: byVariantCount } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .in("variant_id", variantIds);
    if ((byVariantCount || 0) > orderItemsCount) {
      orderItemsCount = byVariantCount || 0;
    }
  }

  const { count: reviewsCount } = await db
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  return {
    variantIds,
    orderItemsCount,
    reviewsCount: reviewsCount || 0,
    hasHistory: orderItemsCount > 0 || (reviewsCount || 0) > 0,
  };
}

export async function cleanupCartItemsForProduct(db: SupabaseClient, productId: string) {
  const { data: variants } = await db
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  const variantIds = (variants || []).map((v: any) => v.id);
  if (variantIds.length > 0) {
    await db.from("cart_items").delete().in("variant_id", variantIds);
  }
}

export async function fetchEnrichedProductById(db: SupabaseClient, productId: string): Promise<Product | null> {
  const { data, error } = await db
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
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...(data as Product),
    images: [...((data as any).images || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    ),
    price_slabs: [...((data as any).price_slabs || [])].sort(
      (a, b) => a.min_qty - b.min_qty
    ),
  };
}

export async function recordProductAuditLog(
  db: SupabaseClient,
  params: {
    productId?: string | null;
    productName: string;
    shopId?: string | null;
    actorId: string;
    actorRole: string;
    action: ProductAuditAction;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason?: string | null;
    metadata?: Record<string, any>;
  }
) {
  await db.from("product_audit_logs").insert({
    product_id: params.productId ?? null,
    product_name: params.productName,
    shop_id: params.shopId ?? null,
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action: params.action,
    previous_status: params.previousStatus ?? null,
    new_status: params.newStatus ?? null,
    reason: params.reason?.trim() || null,
    metadata: params.metadata || {},
  });

  if (
    params.productId &&
    params.action !== "deleted" &&
    params.newStatus &&
    (params.previousStatus !== params.newStatus || params.action === "created" || params.action === "bulk_imported")
  ) {
    await db.from("product_status_history").insert({
      product_id: params.productId,
      from_status: params.previousStatus ?? null,
      to_status: params.newStatus,
      changed_by: params.actorId,
      note: params.reason?.trim() || null,
    });
  }
}

export async function sendNotification(
  db: SupabaseClient,
  params: {
    userId: string;
    title: string;
    message: string;
    linkUrl?: string;
  }
) {
  await db.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    link_url: params.linkUrl || null,
    is_read: false,
  });
}

export async function notifyAdminsOfSubmission(
  db: SupabaseClient,
  params: {
    productName: string;
    shopName: string;
    isResubmission?: boolean;
  }
) {
  const { data: admins } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins || admins.length === 0) return;

  await db.from("notifications").insert(
    admins.map((a: any) => ({
      user_id: a.id,
      title: params.isResubmission ? "Product Re-Review Required" : "New Product Pending Approval",
      message: `${params.shopName} ${params.isResubmission ? "updated live content on" : "submitted"} "${params.productName}" for moderation review.`,
      link_url: "/admin/moderation",
      is_read: false,
    }))
  );
}
