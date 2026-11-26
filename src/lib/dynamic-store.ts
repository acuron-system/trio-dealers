import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Category, Product } from "@/types/database";

export interface DynamicBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  placement: string;
  sort_order: number;
}

export interface HomepageSectionConfig {
  id: string;
  section_key: string;
  title: string;
  subtitle: string | null;
  section_type: string;
  config: Record<string, any>;
  sort_order: number;
  is_active: boolean;
}

export interface FlashSaleEntry {
  id: string;
  title: string;
  product_id: string | null;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  product?: Product | null;
}

export interface DynamicHomePayload {
  configured: boolean;
  sections: HomepageSectionConfig[];
  banners: DynamicBanner[];
  categories: Category[];
  featuredProducts: Product[];
  flashSales: FlashSaleEntry[];
  metrics: {
    approvedProductsCount: number;
    verifiedShopsCount: number;
    activeCategoriesCount: number;
  };
  sampleB2BProduct: Product | null;
}

const EMPTY_HOME: DynamicHomePayload = {
  configured: false,
  sections: [],
  banners: [],
  categories: [],
  featuredProducts: [],
  flashSales: [],
  metrics: {
    approvedProductsCount: 0,
    verifiedShopsCount: 0,
    activeCategoriesCount: 0,
  },
  sampleB2BProduct: null,
};

async function fetchDynamicHomeRaw(): Promise<DynamicHomePayload> {
  if (!isSupabaseConfigured()) {
    return EMPTY_HOME;
  }

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const nowIso = new Date().toISOString();

    const [
      { data: sections },
      { data: banners },
      { data: categories },
      { data: products },
      { data: flashSales },
      { count: productsCount },
      { count: shopsCount },
    ] = await Promise.all([
      db
        .from("homepage_sections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      db
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      db
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      db
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
        .eq("shop.is_suspended", false)
        .order("created_at", { ascending: false })
        .limit(12),
      db
        .from("flash_sales")
        .select("*")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso)
        .order("ends_at", { ascending: true })
        .limit(6),
      db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .is("deleted_at", null),
      db
        .from("shops")
        .select("id", { count: "exact", head: true })
        .eq("kyc_status", "approved")
        .eq("is_suspended", false),
    ]);

    const visibleBanners = ((banners || []) as Array<any>).filter((b) => {
      if (b.start_at && b.start_at > nowIso) return false;
      if (b.end_at && b.end_at < nowIso) return false;
      return true;
    });

    const visibleSections = ((sections || []) as Array<any>).filter((s) => {
      if (s.start_at && s.start_at > nowIso) return false;
      if (s.end_at && s.end_at < nowIso) return false;
      return true;
    });

    const productList = (products || []) as Product[];
    const productById = new Map(productList.map((p) => [p.id, p]));
    const sampleB2BProduct =
      productList.find((p) => p.sell_b2b && (p.price_slabs?.length || 0) > 0) ||
      productList.find((p) => p.sell_b2b) ||
      null;

    return {
      configured: true,
      sections: visibleSections,
      banners: visibleBanners,
      categories: (categories || []) as Category[],
      featuredProducts: productList.slice(0, 8),
      flashSales: ((flashSales || []) as Array<any>).map((f) => ({
        ...f,
        product: f.product_id ? productById.get(f.product_id) || null : null,
      })),
      metrics: {
        approvedProductsCount: productsCount ?? productList.length,
        verifiedShopsCount: shopsCount ?? 0,
        activeCategoriesCount: (categories || []).length,
      },
      sampleB2BProduct,
    };
  } catch {
    return EMPTY_HOME;
  }
}

export const getDynamicHomePayload = unstable_cache(
  fetchDynamicHomeRaw,
  ["dynamic-home-payload"],
  {
    revalidate: 60,
    tags: ["homepage", "banners", "products", "categories", "deals"],
  }
);

