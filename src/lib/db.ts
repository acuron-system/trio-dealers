import { SupabaseClient } from "@supabase/supabase-js";
import {
  Category,
  Brand,
  SizeChart,
  Product,
  Shop,
  B2BAccount,
  Order,
  SubOrder,
  Delivery,
  RfqRequest,
  Payout,
  ShopLedger,
  UserRole,
} from "@/types/database";

export function getDashboardPathForRole(role?: UserRole | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "shop":
      return "/shop-dashboard";
    case "b2b":
      return "/b2b/dashboard";
    case "transporter":
      return "/transporter";
    default:
      return "/account";
  }
}

export async function fetchExtendedProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string
) {
  const [{ data: profile, error }, { data: shop }, { data: b2bAccount }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("shops")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("b2b_accounts").select("*").eq("user_id", userId).maybeSingle(),
    ]);

  if (error || !profile) {
    return null;
  }

  const isApproved =
    profile.role === "shop"
      ? shop?.kyc_status === "approved"
      : profile.role === "b2b"
      ? b2bAccount?.verification_status === "approved"
      : profile.is_active;

  return {
    ...profile,
    email: profile.email || email || undefined,
    is_approved: isApproved,
    shop_name: shop?.shop_name || b2bAccount?.business_name || null,
    gst_no: shop?.gstin || b2bAccount?.gstin || null,
    credit_balance: b2bAccount?.credit_balance ?? 0,
    shop: (shop as Shop) || undefined,
    b2b_account: (b2bAccount as B2BAccount) || undefined,
  };
}

export async function fetchCategories(supabase: SupabaseClient, includeInactive = false): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (!includeInactive) {
    query = query.or("is_active.is.null,is_active.eq.true");
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as Category[];
}

export async function fetchBrands(supabase: SupabaseClient, includeInactive = false): Promise<Brand[]> {
  let query = supabase
    .from("brands")
    .select("*")
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Brand[];
}

export async function fetchSizeCharts(supabase: SupabaseClient): Promise<SizeChart[]> {
  const { data, error } = await supabase
    .from("size_charts")
    .select("*, category:categories(*)")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as SizeChart[];
}

export async function fetchPublicProducts(
  supabase: SupabaseClient,
  options?: { shopId?: string; includeAllForAdmin?: boolean }
): Promise<Product[]> {
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

  if (!options?.includeAllForAdmin) {
    query = query
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .eq("is_archived", false)
      .is("deleted_at", null);
  } else if (options?.shopId) {
    query = query.is("deleted_at", null);
  }

  if (options?.shopId) {
    query = query.eq("shop_id", options.shopId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Product[]).map((p) => ({
    ...p,
    images: [...(p.images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    price_slabs: [...(p.price_slabs || [])].sort((a, b) => a.min_qty - b.min_qty),
  }));
}

export async function fetchProductBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Product | null> {
  const { data, error } = await supabase
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
      price_slabs(*),
      reviews(*, user:profiles(id, full_name, role, is_active, phone, created_at))
    `
    )
    .eq("slug", slug)
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

export async function fetchShopBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Shop | null> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Shop;
}

export async function fetchOrdersWithDetails(
  supabase: SupabaseClient,
  userId?: string
): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select(
      `
      *,
      profile:profiles(*),
      sub_orders(
        *,
        shop:shops(*),
        items:order_items(*),
        history:order_status_history(*)
      )
    `
    )
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Order[];
}

export async function fetchOrderByNo(
  supabase: SupabaseClient,
  orderNo: string
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      profile:profiles(*),
      sub_orders(
        *,
        shop:shops(*),
        items:order_items(*),
        history:order_status_history(*)
      )
    `
    )
    .ilike("order_no", orderNo)
    .maybeSingle();

  if (error || !data) return null;
  return data as Order;
}

export async function fetchShopSubOrders(
  supabase: SupabaseClient,
  shopId: string
): Promise<SubOrder[]> {
  const { data, error } = await supabase
    .from("sub_orders")
    .select(
      `
      *,
      shop:shops(*),
      items:order_items(*),
      history:order_status_history(*),
      parent_order:orders(*)
    `
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as SubOrder[];
}

export async function fetchTransporterDeliveries(
  supabase: SupabaseClient,
  transporterId?: string
): Promise<Delivery[]> {
  let query = supabase
    .from("deliveries")
    .select(
      `
      *,
      sub_order:sub_orders(
        *,
        shop:shops(*),
        items:order_items(*),
        parent_order:orders(*)
      )
    `
    )
    .order("created_at", { ascending: false });

  if (transporterId) {
    query = query.eq("transporter_id", transporterId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Delivery[];
}

export async function fetchRfqRequests(
  supabase: SupabaseClient,
  b2bAccountId?: string
): Promise<RfqRequest[]> {
  let query = supabase
    .from("rfq_requests")
    .select(
      `
      *,
      product:products(*, variants:product_variants(*), images:product_images(*), price_slabs(*)),
      shop:shops(*),
      b2b_account:b2b_accounts(*),
      quotes:rfq_quotes(*)
    `
    )
    .order("created_at", { ascending: false });

  if (b2bAccountId) {
    query = query.eq("b2b_account_id", b2bAccountId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as RfqRequest[];
}

export async function fetchShopPayoutData(
  supabase: SupabaseClient,
  shopId?: string
): Promise<{ payouts: Payout[]; ledger: ShopLedger[] }> {
  let payQuery = supabase
    .from("payouts")
    .select("*, shop:shops(*)")
    .order("created_at", { ascending: false });

  let ledgerQuery = supabase
    .from("shop_ledger")
    .select("*")
    .order("created_at", { ascending: false });

  if (shopId) {
    payQuery = payQuery.eq("shop_id", shopId);
    ledgerQuery = ledgerQuery.eq("shop_id", shopId);
  }

  const [{ data: payouts }, { data: ledger }] = await Promise.all([payQuery, ledgerQuery]);

  return {
    payouts: (payouts as Payout[]) || [],
    ledger: (ledger as ShopLedger[]) || [],
  };
}

