-- ==============================================================================
-- TRIO DEALERS - PRODUCTION MULTI-VENDOR MARKETPLACE SCHEMA
-- PostgreSQL + RLS + Triggers + Realtime + Trigram Search
-- ==============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text not null,
  phone text,
  role text not null check (role in ('admin', 'shop', 'b2b', 'transporter', 'user')) default 'user',
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Ensure columns & role constraint exist if upgrading from an earlier schema
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'shop', 'b2b', 'transporter', 'user'));

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(lower(email));

-- 2. SHOPS (Seller KYC & Storefronts)
create table if not exists public.shops (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  shop_name text not null,
  slug text not null unique,
  logo_url text,
  banner_url text,
  gstin text,
  pan text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  bank_name text not null,
  bank_account_no text not null,
  bank_ifsc text not null,
  kyc_status text not null check (kyc_status in ('pending', 'approved', 'rejected', 'suspended')) default 'pending',
  kyc_doc_url text,
  commission_rate numeric(5,2) not null default 10.00,
  rating numeric(3,2) not null default 5.00,
  reviews_count integer not null default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_shops_owner on public.shops(owner_id);
create index if not exists idx_shops_slug on public.shops(slug);
create index if not exists idx_shops_kyc on public.shops(kyc_status);

-- 3. B2B ACCOUNTS (Amazon Business-style buyer accounts)
create table if not exists public.b2b_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  business_name text not null,
  gstin text not null,
  pan text,
  trade_license_url text,
  verification_status text not null check (verification_status in ('pending', 'approved', 'rejected')) default 'pending',
  credit_limit numeric(12,2) not null default 0.00,
  credit_balance numeric(12,2) not null default 0.00,
  payment_terms text not null check (payment_terms in ('prepaid', 'net15', 'net30')) default 'prepaid',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_b2b_user on public.b2b_accounts(user_id);
create index if not exists idx_b2b_status on public.b2b_accounts(verification_status);

-- 4. ADDRESSES
create table if not exists public.addresses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean default false,
  address_type text not null check (address_type in ('home', 'business', 'warehouse')) default 'home',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.addresses add column if not exists name text;
alter table public.addresses add column if not exists phone text;
alter table public.addresses add column if not exists address_type text default 'home';
alter table public.addresses add column if not exists created_at timestamptz default timezone('utc'::text, now()) not null;

create index if not exists idx_addresses_user on public.addresses(user_id);

-- 5. CATEGORIES (Supports sub-categories via parent_id)
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  commission_override numeric(5,2),
  sort_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists commission_override numeric(5,2);
alter table public.categories add column if not exists sort_order integer default 0;
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists created_at timestamptz default timezone('utc'::text, now()) not null;

create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_parent on public.categories(parent_id);

-- 5B. BRANDS
create table if not exists public.brands (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_brands_slug on public.brands(slug);

-- 5C. SIZE CHARTS
create table if not exists public.size_charts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  chart jsonb not null default '{"columns":[],"rows":[]}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_size_charts_cat on public.size_charts(category_id);

-- 6. PRODUCTS (Multi-vendor with draft/approval queue, soft-delete, catalog attributes, & retail/B2B selectors)
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  size_chart_id uuid references public.size_charts(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  care_instructions text,
  video_url text,
  fabric text,
  fit text,
  pattern text,
  occasion text,
  audience text check (audience in ('men', 'women', 'kids', 'unisex')) default 'unisex',
  hsn_code text,
  gst_rate numeric(5,2) not null default 5.00,
  mrp numeric(10,2) not null,
  retail_price numeric(10,2) not null,
  b2b_moq integer not null default 10,
  sell_retail boolean not null default true,
  sell_b2b boolean not null default true,
  approval_status text not null check (approval_status in ('draft', 'pending', 'approved', 'rejected', 'changes_requested')) default 'pending',
  moderation_note text,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  archived_reason text,
  deleted_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.products add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table public.products add column if not exists brand_id uuid references public.brands(id) on delete set null;
alter table public.products add column if not exists size_chart_id uuid references public.size_charts(id) on delete set null;
alter table public.products add column if not exists care_instructions text;
alter table public.products add column if not exists video_url text;
alter table public.products add column if not exists fit text;
alter table public.products add column if not exists pattern text;
alter table public.products add column if not exists occasion text;
alter table public.products add column if not exists audience text default 'unisex';
alter table public.products add column if not exists hsn_code text;
alter table public.products add column if not exists gst_rate numeric(5,2) not null default 5.00;
alter table public.products add column if not exists mrp numeric(10,2) default 0;
alter table public.products add column if not exists b2b_moq integer not null default 10;
alter table public.products add column if not exists sell_retail boolean not null default true;
alter table public.products add column if not exists sell_b2b boolean not null default true;
alter table public.products add column if not exists approval_status text not null default 'pending';
alter table public.products add column if not exists moderation_note text;
alter table public.products add column if not exists is_archived boolean not null default false;
alter table public.products add column if not exists archived_reason text;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.products add column if not exists submitted_at timestamptz;
alter table public.products add column if not exists approved_at timestamptz;
alter table public.products add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.products add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.products add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;
alter table public.products drop constraint if exists products_approval_status_check;
alter table public.products add constraint products_approval_status_check check (approval_status in ('draft', 'pending', 'approved', 'rejected', 'changes_requested'));
alter table public.products drop constraint if exists products_audience_check;
alter table public.products add constraint products_audience_check check (audience in ('men', 'women', 'kids', 'unisex'));

create index if not exists idx_products_shop on public.products(shop_id);
create index if not exists idx_products_shop_status on public.products(shop_id, approval_status);
create index if not exists idx_products_cat on public.products(category_id);
create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_audience on public.products(audience);
create index if not exists idx_products_approval on public.products(approval_status);
create index if not exists idx_products_live on public.products(category_id, created_at desc)
  where approval_status = 'approved' and is_active = true and is_archived = false and deleted_at is null;
create index if not exists idx_products_search on public.products using gin (name gin_trgm_ops);

-- 7. PRODUCT VARIANTS
create table if not exists public.product_variants (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  size text not null,
  color text not null,
  color_hex text,
  sku text not null unique,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.product_variants add column if not exists color_hex text;
alter table public.product_variants add column if not exists low_stock_threshold integer not null default 10;
alter table public.product_variants add column if not exists is_active boolean not null default true;
alter table public.product_variants drop constraint if exists product_variants_stock_nonneg;
alter table public.product_variants add constraint product_variants_stock_nonneg check (stock_qty >= 0);

create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_variants_sku on public.product_variants(sku);

-- 8. PRODUCT IMAGES
create table if not exists public.product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  variant_color text,
  url text not null,
  alt_text text,
  sort_order integer default 0,
  is_cover boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.product_images add column if not exists variant_color text;
alter table public.product_images add column if not exists alt_text text;
alter table public.product_images add column if not exists is_cover boolean not null default false;

create index if not exists idx_product_images_prod on public.product_images(product_id);

-- 9. PRICE SLABS (Wholesale volume discounts)
create table if not exists public.price_slabs (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  min_qty integer not null,
  unit_price numeric(10,2) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (product_id, min_qty)
);

create index if not exists idx_price_slabs_prod on public.price_slabs(product_id);

-- 10. CART ITEMS
create table if not exists public.cart_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  variant_id uuid references public.product_variants(id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  buyer_type text not null check (buyer_type in ('retail', 'b2b')) default 'retail',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (user_id, variant_id)
);

alter table public.cart_items add column if not exists buyer_type text not null default 'retail';
alter table public.cart_items add column if not exists created_at timestamptz default timezone('utc'::text, now()) not null;

create index if not exists idx_cart_user on public.cart_items(user_id);

-- 11. WISHLIST
create table if not exists public.wishlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique(user_id, product_id)
);

-- 12. COUPONS
create table if not exists public.coupons (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null,
  min_order_value numeric(10,2) not null default 0.00,
  max_discount numeric(10,2) not null default 999999.00,
  usage_limit integer not null default 1000,
  times_used integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_to timestamptz not null,
  is_active boolean not null default true
);

-- 13. PARENT ORDERS (Aggregates multi-vendor checkout)
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  order_no text not null unique,
  user_id uuid references public.profiles(id) on delete restrict not null,
  order_type text not null check (order_type in ('retail', 'b2b')),
  status text not null check (status in ('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')) default 'placed',
  payment_method text not null check (payment_method in ('razorpay', 'cod', 'bank_transfer', 'credit_terms')),
  payment_status text not null check (payment_status in ('pending', 'paid', 'failed', 'refunded')) default 'pending',
  subtotal numeric(12,2) not null,
  shipping_fee numeric(10,2) not null default 0.00,
  tax_total numeric(12,2) not null default 0.00,
  discount_amount numeric(10,2) not null default 0.00,
  total_amount numeric(12,2) not null,
  coupon_id uuid references public.coupons(id),
  address_snapshot jsonb not null,
  payment_proof_url text,
  razorpay_order_id text,
  razorpay_payment_id text,
  notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.orders add column if not exists shipping_fee numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists tax_total numeric(12,2) not null default 0.00;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists total_amount numeric(12,2) default 0.00;
alter table public.orders add column if not exists coupon_id uuid references public.coupons(id);
alter table public.orders add column if not exists payment_proof_url text;
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check check (order_type in ('retail', 'b2b', 'wholesale'));
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('razorpay', 'cod', 'bank_transfer', 'credit_terms', 'upi'));
alter table public.orders drop constraint if exists orders_status_check;

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_order_no on public.orders(order_no);

-- 14. SUB-ORDERS (Per-shop fulfilment, commission & invoice tracking)
create table if not exists public.sub_orders (
  id uuid default gen_random_uuid() primary key,
  parent_order_id uuid references public.orders(id) on delete cascade not null,
  shop_id uuid references public.shops(id) on delete restrict not null,
  sub_order_no text not null unique,
  status text not null check (status in ('placed', 'accepted', 'packed', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'return_requested', 'returned')) default 'placed',
  subtotal numeric(12,2) not null,
  shipping_fee numeric(10,2) not null default 0.00,
  tax_total numeric(12,2) not null default 0.00,
  total numeric(12,2) not null,
  commission_amount numeric(12,2) not null default 0.00,
  shop_earnings numeric(12,2) not null default 0.00,
  transporter_id uuid references public.profiles(id) on delete set null,
  invoice_no text,
  packing_slip_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_sub_orders_parent on public.sub_orders(parent_order_id);
create index if not exists idx_sub_orders_shop on public.sub_orders(shop_id);
create index if not exists idx_sub_orders_transporter on public.sub_orders(transporter_id);

-- 15. ORDER ITEMS
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  sub_order_id uuid references public.sub_orders(id) on delete cascade not null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant_info text,
  hsn_code text,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null,
  cgst numeric(10,2) not null default 0.00,
  sgst numeric(10,2) not null default 0.00,
  igst numeric(10,2) not null default 0.00
);

alter table public.order_items add column if not exists sub_order_id uuid references public.sub_orders(id) on delete cascade;
alter table public.order_items add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.order_items add column if not exists variant_info text;
alter table public.order_items add column if not exists hsn_code text;
alter table public.order_items add column if not exists unit_price numeric(10,2) default 0.00;
alter table public.order_items add column if not exists line_total numeric(12,2) default 0.00;
alter table public.order_items add column if not exists cgst numeric(10,2) not null default 0.00;
alter table public.order_items add column if not exists sgst numeric(10,2) not null default 0.00;
alter table public.order_items add column if not exists igst numeric(10,2) not null default 0.00;

create index if not exists idx_order_items_sub_order on public.order_items(sub_order_id);

-- 16. ORDER STATUS HISTORY
create table if not exists public.order_status_history (
  id uuid default gen_random_uuid() primary key,
  sub_order_id uuid references public.sub_orders(id) on delete cascade not null,
  status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.order_status_history add column if not exists sub_order_id uuid references public.sub_orders(id) on delete cascade;

create index if not exists idx_status_history_sub_order on public.order_status_history(sub_order_id);

-- 17. DELIVERIES (Two-leg transporter flow: Pickup from Seller -> Delivery to Buyer)
create table if not exists public.deliveries (
  id uuid default gen_random_uuid() primary key,
  sub_order_id uuid references public.sub_orders(id) on delete cascade not null,
  transporter_id uuid references public.profiles(id) on delete cascade not null,
  leg text not null check (leg in ('pickup', 'delivery')),
  status text not null check (status in ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')) default 'assigned',
  failure_reason text,
  proof_url text,
  otp_code text,
  cod_amount numeric(10,2) not null default 0.00,
  cod_collected boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.deliveries add column if not exists sub_order_id uuid references public.sub_orders(id) on delete cascade;
alter table public.deliveries add column if not exists leg text default 'delivery';
alter table public.deliveries add column if not exists failure_reason text;
alter table public.deliveries add column if not exists otp_code text;
alter table public.deliveries add column if not exists cod_amount numeric(10,2) not null default 0.00;
alter table public.deliveries add column if not exists created_at timestamptz default timezone('utc'::text, now()) not null;

create index if not exists idx_deliveries_transporter on public.deliveries(transporter_id);
create index if not exists idx_deliveries_sub_order on public.deliveries(sub_order_id);

-- 18. RFQ (Request for Quotation - B2B custom prices)
create table if not exists public.rfq_requests (
  id uuid default gen_random_uuid() primary key,
  b2b_account_id uuid references public.b2b_accounts(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  shop_id uuid references public.shops(id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  target_price numeric(10,2),
  notes text,
  status text not null check (status in ('requested', 'quoted', 'accepted', 'rejected', 'expired')) default 'requested',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.rfq_quotes (
  id uuid default gen_random_uuid() primary key,
  rfq_id uuid references public.rfq_requests(id) on delete cascade not null,
  quoted_price numeric(10,2) not null,
  min_qty integer not null,
  valid_until timestamptz not null,
  remarks text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 19. REVIEWS
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  comment text not null,
  image_url text,
  is_verified_purchase boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (product_id, user_id)
);

-- 20. SHOP LEDGER & PAYOUTS
create table if not exists public.shop_ledger (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  sub_order_id uuid references public.sub_orders(id) on delete set null,
  type text not null check (type in ('order_credit', 'commission_debit', 'payout_debit', 'refund_debit')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  note text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.payouts (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null check (status in ('pending', 'processing', 'settled', 'failed')) default 'pending',
  reference_id text,
  bank_details jsonb not null,
  settled_at timestamptz,
  settled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 21. B2B CREDIT LEDGER
create table if not exists public.b2b_credit_ledger (
  id uuid default gen_random_uuid() primary key,
  b2b_account_id uuid references public.b2b_accounts(id) on delete cascade not null,
  type text not null check (type in ('credit_used', 'payment_settled', 'limit_increased')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  reference_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 22. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  link_url text,
  is_read boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 23. STOCK MOVEMENTS (Audit log for inventory)
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  variant_id uuid references public.product_variants(id) on delete cascade not null,
  change_qty integer not null,
  reason text not null check (reason in ('initial', 'manual_adjust', 'manual_restock', 'import', 'order_deduction', 'return_restock', 'sale', 'return')),
  reference_id text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.stock_movements add column if not exists note text;
alter table public.stock_movements add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.stock_movements drop constraint if exists stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('initial', 'manual_adjust', 'manual_restock', 'import', 'order_deduction', 'return_restock', 'sale', 'return'));

create index if not exists idx_stock_movements_variant on public.stock_movements(variant_id, created_at desc);

-- 23B. PRODUCT STATUS HISTORY
create table if not exists public.product_status_history (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_product_status_history_prod on public.product_status_history(product_id, created_at desc);

-- 24. PRODUCT AUDIT LOGS (Immutable record of create, edit, approval, unpublish, archive, & delete)
create table if not exists public.product_audit_logs (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  shop_id uuid references public.shops(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  action text not null check (action in (
    'created', 'submitted', 'edited', 'edited_resubmitted',
    'approved', 'changes_requested', 'rejected',
    'unpublished', 'published', 'archived', 'restored', 'deleted', 'bulk_imported'
  )),
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_product_audit_product on public.product_audit_logs(product_id, created_at desc);
create index if not exists idx_product_audit_shop on public.product_audit_logs(shop_id, created_at desc);

-- ==============================================================================
-- DATABASE TRIGGERS & PROCEDURES
-- ==============================================================================

-- 1. Profile, Admin Grant & Pending KYC Auto-Creation on User Signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  requested_role text;
  user_role text;
  v_shop_name text;
  v_shop_slug text;
  v_business_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'user');

  -- Designate annuncio8427@gmail.com as platform admin automatically;
  -- prevent arbitrary public signups from claiming admin or transporter roles.
  if lower(new.email) = 'annuncio8427@gmail.com' then
    user_role := 'admin';
  elsif requested_role in ('shop', 'b2b', 'user') then
    user_role := requested_role;
  else
    user_role := 'user';
  end if;

  insert into public.profiles (id, email, full_name, phone, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    user_role,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case when lower(new.email) = 'annuncio8427@gmail.com' then 'admin' else public.profiles.role end,
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.profiles.phone);

  -- Auto-create pending seller KYC record on shop signup
  if user_role = 'shop' and coalesce(trim(new.raw_user_meta_data->>'shop_name'), '') <> '' then
    v_shop_name := trim(new.raw_user_meta_data->>'shop_name');
    v_shop_slug := regexp_replace(lower(v_shop_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(new.id::text, 1, 6);

    insert into public.shops (
      owner_id, shop_name, slug, gstin, pan,
      address_line1, city, state, pincode,
      bank_name, bank_account_no, bank_ifsc, kyc_status
    )
    values (
      new.id,
      v_shop_name,
      v_shop_slug,
      nullif(trim(new.raw_user_meta_data->>'gstin'), ''),
      nullif(trim(new.raw_user_meta_data->>'pan'), ''),
      coalesce(nullif(trim(new.raw_user_meta_data->>'address'), ''), 'Pending Address'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'Surat'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'state'), ''), 'Gujarat'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'pincode'), ''), '395002'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'bank_name'), ''), 'Pending'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'bank_account_no'), ''), 'Pending'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'bank_ifsc'), ''), 'Pending'),
      'pending'
    )
    on conflict (slug) do nothing;
  end if;

  -- Auto-create pending B2B trade account on wholesale buyer signup
  if user_role = 'b2b' and coalesce(trim(new.raw_user_meta_data->>'business_name'), '') <> '' then
    v_business_name := trim(new.raw_user_meta_data->>'business_name');

    insert into public.b2b_accounts (
      user_id, business_name, gstin, pan, verification_status
    )
    values (
      new.id,
      v_business_name,
      coalesce(nullif(trim(new.raw_user_meta_data->>'gstin'), ''), 'PENDING'),
      nullif(trim(new.raw_user_meta_data->>'pan'), ''),
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Atomic Stock Reduction Trigger on Order Placement
create or replace function public.reduce_stock_on_order()
returns trigger as $$
begin
  if new.variant_id is not null then
    update public.product_variants
    set stock_qty = greatest(0, stock_qty - new.quantity)
    where id = new.variant_id;

    insert into public.stock_movements (variant_id, change_qty, reason, reference_id)
    values (new.variant_id, -new.quantity, 'order_deduction', new.sub_order_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_order_item_stock on public.order_items;
create trigger on_order_item_stock
  after insert on public.order_items
  for each row execute function public.reduce_stock_on_order();

-- 3. Product Governance Triggers (Shop KYC check, Approval Protection, Re-Review on Live Content Edits, Safe Deletion)
create or replace function public.guard_product_mutation()
returns trigger as $$
declare
  v_uid uuid;
  v_is_admin boolean;
  v_shop_owner uuid;
  v_shop_kyc text;
begin
  -- Allow server-side service_role and SQL editor seed/maintenance operations
  if current_setting('role', true) = 'service_role' or auth.uid() is null then
    new.updated_at := timezone('utc'::text, now());
    return new;
  end if;

  v_uid := auth.uid();
  v_is_admin := public.is_admin();

  if v_is_admin then
    new.updated_at := timezone('utc'::text, now());
    return new;
  end if;

  select owner_id, kyc_status
  into v_shop_owner, v_shop_kyc
  from public.shops
  where id = new.shop_id;

  if v_shop_owner is null or v_shop_owner <> v_uid then
    raise exception 'You can only manage products belonging to your own shop.';
  end if;

  if v_shop_kyc <> 'approved' then
    raise exception 'Only KYC-approved shops can add or modify products.';
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status not in ('draft', 'pending') then
      new.approval_status := 'pending';
    end if;
    new.moderation_note := null;
    new.updated_at := timezone('utc'::text, now());
    return new;
  end if;

  -- On UPDATE by non-admin shop owner
  if new.shop_id <> old.shop_id then
    raise exception 'Product shop ownership cannot be transferred.';
  end if;

  -- Prevent shops from self-approving, rejecting, or altering moderation notes directly
  if new.approval_status is distinct from old.approval_status then
    if new.approval_status not in ('draft', 'pending') then
      raise exception 'Only platform administrators can approve or reject products.';
    end if;
    if old.approval_status = 'approved' and new.approval_status = 'draft' then
      raise exception 'Use Unpublish or Archive for already-approved products.';
    end if;
  end if;

  if pg_trigger_depth() <= 1 then
    if new.approval_status = 'pending' and old.approval_status in ('changes_requested', 'rejected') then
      new.moderation_note := null;
    else
      new.moderation_note := old.moderation_note;
    end if;
  end if;

  -- Live product edits to name or description require re-approval
  if old.approval_status = 'approved' and (
    new.name is distinct from old.name
    or coalesce(new.description, '') is distinct from coalesce(old.description, '')
  ) then
    new.approval_status := 'pending';
    new.moderation_note := 'Queued for re-approval after live title or description edit.';
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_guard_product_mutation on public.products;
create trigger on_guard_product_mutation
  before insert or update on public.products
  for each row execute function public.guard_product_mutation();

create or replace function public.requeue_product_on_image_change()
returns trigger as $$
declare
  v_product_id uuid;
  v_status text;
begin
  if current_setting('role', true) = 'service_role' or auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  v_product_id := coalesce(new.product_id, old.product_id);
  select approval_status into v_status from public.products where id = v_product_id;

  if v_status = 'approved' then
    update public.products
    set approval_status = 'pending',
        moderation_note = 'Queued for re-approval after product image update.',
        updated_at = timezone('utc'::text, now())
    where id = v_product_id;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_requeue_product_on_image_change on public.product_images;
create trigger on_requeue_product_on_image_change
  after insert or update or delete on public.product_images
  for each row execute function public.requeue_product_on_image_change();

create or replace function public.guard_product_delete()
returns trigger as $$
declare
  v_has_history boolean;
begin
  -- Admins or service_role may permanently delete with audit logging; shops cannot hard-delete ordered/reviewed items
  if current_setting('role', true) = 'service_role' or auth.uid() is null or public.is_admin() then
    return old;
  end if;

  select exists (
    select 1 from public.order_items oi
    where oi.product_id = old.id
       or oi.variant_id in (select pv.id from public.product_variants pv where pv.product_id = old.id)
  ) or exists (
    select 1 from public.reviews r where r.product_id = old.id
  ) into v_has_history;

  if v_has_history then
    raise exception 'Products with orders, returns, or reviews cannot be permanently deleted. Archive the product instead.';
  end if;

  return old;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_guard_product_delete on public.products;
create trigger on_guard_product_delete
  before delete on public.products
  for each row execute function public.guard_product_delete();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.b2b_accounts enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.size_charts enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.price_slabs enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.sub_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.deliveries enable row level security;
alter table public.rfq_requests enable row level security;
alter table public.rfq_quotes enable row level security;
alter table public.reviews enable row level security;
alter table public.shop_ledger enable row level security;
alter table public.payouts enable row level security;
alter table public.b2b_credit_ledger enable row level security;
alter table public.notifications enable row level security;
alter table public.stock_movements enable row level security;
alter table public.product_status_history enable row level security;
alter table public.product_audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and is_active = true
  );
$$ language sql security definer set search_path = '';

-- Helper: safely read current user's role without bypassing RLS loops
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = (select auth.uid());
$$ language sql security definer set search_path = '';

-- PROFILES
drop policy if exists "Read profile" on public.profiles;
create policy "Read profile" on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Update profile" on public.profiles;
create policy "Update profile" on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (
    public.is_admin()
    or (auth.uid() = id and role = public.current_user_role())
  );

drop policy if exists "Admin all profiles" on public.profiles;
create policy "Admin all profiles" on public.profiles for all using (public.is_admin());

-- SHOPS
drop policy if exists "Approved shops publicly readable" on public.shops;
create policy "Approved shops publicly readable" on public.shops for select using (
  kyc_status = 'approved' or owner_id = auth.uid() or public.is_admin()
);

drop policy if exists "Sellers manage own shop" on public.shops;
create policy "Sellers manage own shop" on public.shops for all using (
  owner_id = auth.uid() or public.is_admin()
);

-- B2B ACCOUNTS
drop policy if exists "B2B read own or admin" on public.b2b_accounts;
create policy "B2B read own or admin" on public.b2b_accounts for select using (
  user_id = auth.uid() or public.is_admin()
);

drop policy if exists "B2B insert own" on public.b2b_accounts;
create policy "B2B insert own" on public.b2b_accounts for insert with check (
  user_id = auth.uid() or public.is_admin()
);

drop policy if exists "B2B admin update" on public.b2b_accounts;
create policy "B2B admin update" on public.b2b_accounts for all using (public.is_admin());

-- ADDRESSES
drop policy if exists "Users manage own addresses" on public.addresses;
create policy "Users manage own addresses" on public.addresses for all using (
  user_id = auth.uid() or public.is_admin()
);

-- CATEGORIES
drop policy if exists "Categories public read" on public.categories;
create policy "Categories public read" on public.categories for select using (true);

drop policy if exists "Admin manage categories" on public.categories;
create policy "Admin manage categories" on public.categories for all using (public.is_admin());

-- PRODUCTS
drop policy if exists "Public view approved products" on public.products;
create policy "Public view approved products" on public.products for select using (
  public.is_admin()
  or (
    products.deleted_at is null
    and exists (
      select 1 from public.shops s
      where s.id = products.shop_id and s.owner_id = (select auth.uid())
    )
  )
  or (
    products.approval_status = 'approved'
    and products.is_active = true
    and products.is_archived = false
    and products.deleted_at is null
    and coalesce(public.current_user_role(), 'user') <> 'transporter'
    and exists (
      select 1 from public.shops s
      where s.id = products.shop_id and s.kyc_status = 'approved'
    )
  )
);

drop policy if exists "Sellers manage own products" on public.products;
drop policy if exists "Approved shops insert own products" on public.products;
create policy "Approved shops insert own products" on public.products for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  );

drop policy if exists "Approved shops update own products" on public.products;
create policy "Approved shops update own products" on public.products for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  );

drop policy if exists "Approved shops or admin delete products" on public.products;
create policy "Approved shops or admin delete products" on public.products for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  );

-- PRODUCT VARIANTS & IMAGES
drop policy if exists "Public read variants" on public.product_variants;
create policy "Public read variants" on public.product_variants for select using (
  coalesce(public.current_user_role(), 'user') <> 'transporter' or public.is_admin()
);

drop policy if exists "Seller or admin manage variants" on public.product_variants;
create policy "Seller or admin manage variants" on public.product_variants for all
  to authenticated
  using (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = product_variants.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  );

drop policy if exists "Public read product images" on public.product_images;
create policy "Public read product images" on public.product_images for select using (
  coalesce(public.current_user_role(), 'user') <> 'transporter' or public.is_admin()
);

drop policy if exists "Seller or admin manage images" on public.product_images;
create policy "Seller or admin manage images" on public.product_images for all
  to authenticated
  using (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = product_images.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = product_images.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  );

-- PRICE SLABS (Visible to approved B2B buyers, approved shops, product owner, or admin)
drop policy if exists "Read price slabs for verified trade roles" on public.price_slabs;
create policy "Read price slabs for verified trade roles" on public.price_slabs for select using (
  public.is_admin()
  or exists (select 1 from public.products p join public.shops s on s.id = p.shop_id where p.id = price_slabs.product_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.b2b_accounts b where b.user_id = (select auth.uid()) and b.verification_status = 'approved')
  or exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.kyc_status = 'approved')
);

drop policy if exists "Manage price slabs" on public.price_slabs;
create policy "Manage price slabs" on public.price_slabs for all
  to authenticated
  using (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = price_slabs.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.products p join public.shops s on s.id = p.shop_id
      where p.id = price_slabs.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    ) or public.is_admin()
  );

-- CART & WISHLIST
drop policy if exists "Users manage own cart" on public.cart_items;
create policy "Users manage own cart" on public.cart_items for all using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own wishlist" on public.wishlist;
create policy "Users manage own wishlist" on public.wishlist for all using (user_id = auth.uid() or public.is_admin());

-- COUPONS
drop policy if exists "Read active coupons" on public.coupons;
create policy "Read active coupons" on public.coupons for select using (is_active = true or public.is_admin());

drop policy if exists "Admin manage coupons" on public.coupons;
create policy "Admin manage coupons" on public.coupons for all using (public.is_admin());

-- ORDERS
drop policy if exists "View orders" on public.orders;
create policy "View orders" on public.orders for select using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.sub_orders so
    join public.shops s on s.id = so.shop_id
    where so.parent_order_id = orders.id and s.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.sub_orders so
    where so.parent_order_id = orders.id and so.transporter_id = auth.uid()
  )
);

drop policy if exists "Users create own orders" on public.orders;
create policy "Users create own orders" on public.orders for insert with check (
  user_id = auth.uid() or public.is_admin()
);

drop policy if exists "Admin update orders" on public.orders;
create policy "Admin update orders" on public.orders for update using (public.is_admin());

-- SUB-ORDERS
drop policy if exists "View sub_orders" on public.sub_orders;
create policy "View sub_orders" on public.sub_orders for select using (
  exists (select 1 from public.shops where shops.id = sub_orders.shop_id and shops.owner_id = auth.uid())
  or exists (select 1 from public.orders where orders.id = sub_orders.parent_order_id and orders.user_id = auth.uid())
  or transporter_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Create sub_orders" on public.sub_orders;
create policy "Create sub_orders" on public.sub_orders for insert with check (
  exists (select 1 from public.orders where orders.id = sub_orders.parent_order_id and orders.user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Update sub_orders" on public.sub_orders;
create policy "Update sub_orders" on public.sub_orders for update using (
  exists (select 1 from public.shops where shops.id = sub_orders.shop_id and shops.owner_id = auth.uid())
  or transporter_id = auth.uid()
  or public.is_admin()
);

-- ORDER ITEMS & HISTORY
drop policy if exists "View order items" on public.order_items;
create policy "View order items" on public.order_items for select using (
  exists (
    select 1 from public.sub_orders so
    left join public.shops s on s.id = so.shop_id
    left join public.orders o on o.id = so.parent_order_id
    where so.id = order_items.sub_order_id
      and (o.user_id = auth.uid() or s.owner_id = auth.uid() or so.transporter_id = auth.uid())
  ) or public.is_admin()
);

drop policy if exists "Insert order items" on public.order_items;
create policy "Insert order items" on public.order_items for insert with check (
  exists (
    select 1 from public.sub_orders so
    join public.orders o on o.id = so.parent_order_id
    where so.id = order_items.sub_order_id and o.user_id = auth.uid()
  ) or public.is_admin()
);

drop policy if exists "Manage status history" on public.order_status_history;
create policy "Manage status history" on public.order_status_history for all using (
  exists (
    select 1 from public.sub_orders so
    left join public.shops s on s.id = so.shop_id
    left join public.orders o on o.id = so.parent_order_id
    where so.id = order_status_history.sub_order_id
      and (o.user_id = auth.uid() or s.owner_id = auth.uid() or so.transporter_id = auth.uid())
  ) or public.is_admin()
);

-- DELIVERIES
drop policy if exists "View and update deliveries" on public.deliveries;
create policy "View and update deliveries" on public.deliveries for select using (
  transporter_id = auth.uid()
  or exists (
    select 1 from public.sub_orders so
    left join public.shops s on s.id = so.shop_id
    left join public.orders o on o.id = so.parent_order_id
    where so.id = deliveries.sub_order_id and (s.owner_id = auth.uid() or o.user_id = auth.uid())
  )
  or public.is_admin()
);

drop policy if exists "Transporter update delivery" on public.deliveries;
create policy "Transporter update delivery" on public.deliveries for update using (
  transporter_id = auth.uid() or public.is_admin()
);

drop policy if exists "Admin insert deliveries" on public.deliveries;
create policy "Admin insert deliveries" on public.deliveries for insert with check (public.is_admin());

-- RFQ REQUESTS & QUOTES
drop policy if exists "Manage rfq requests" on public.rfq_requests;
create policy "Manage rfq requests" on public.rfq_requests for all using (
  exists (select 1 from public.b2b_accounts b where b.id = rfq_requests.b2b_account_id and b.user_id = auth.uid())
  or exists (select 1 from public.shops s where s.id = rfq_requests.shop_id and s.owner_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Manage rfq quotes" on public.rfq_quotes;
create policy "Manage rfq quotes" on public.rfq_quotes for all using (
  exists (
    select 1 from public.rfq_requests r
    left join public.b2b_accounts b on b.id = r.b2b_account_id
    left join public.shops s on s.id = r.shop_id
    where r.id = rfq_quotes.rfq_id and (b.user_id = auth.uid() or s.owner_id = auth.uid())
  ) or public.is_admin()
);

-- REVIEWS
drop policy if exists "Public read reviews" on public.reviews;
create policy "Public read reviews" on public.reviews for select using (true);

drop policy if exists "Users manage own reviews" on public.reviews;
create policy "Users manage own reviews" on public.reviews for all using (
  user_id = auth.uid() or public.is_admin()
);

-- LEDGERS & PAYOUTS
drop policy if exists "Shop view own ledger" on public.shop_ledger;
create policy "Shop view own ledger" on public.shop_ledger for select using (
  exists (select 1 from public.shops s where s.id = shop_ledger.shop_id and s.owner_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Admin manage shop ledger" on public.shop_ledger;
create policy "Admin manage shop ledger" on public.shop_ledger for all using (public.is_admin());

drop policy if exists "Shop view payouts" on public.payouts;
create policy "Shop view payouts" on public.payouts for select using (
  exists (select 1 from public.shops s where s.id = payouts.shop_id and s.owner_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Shop request payout" on public.payouts;
create policy "Shop request payout" on public.payouts for insert with check (
  (exists (select 1 from public.shops s where s.id = payouts.shop_id and s.owner_id = auth.uid()) and status = 'pending')
  or public.is_admin()
);

drop policy if exists "Admin settle payouts" on public.payouts;
create policy "Admin settle payouts" on public.payouts for update using (public.is_admin());

drop policy if exists "B2B view credit ledger" on public.b2b_credit_ledger;
create policy "B2B view credit ledger" on public.b2b_credit_ledger for select using (
  exists (select 1 from public.b2b_accounts b where b.id = b2b_credit_ledger.b2b_account_id and b.user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Admin manage b2b credit ledger" on public.b2b_credit_ledger;
create policy "Admin manage b2b credit ledger" on public.b2b_credit_ledger for all using (public.is_admin());

-- NOTIFICATIONS
drop policy if exists "Users manage own notifications" on public.notifications;
create policy "Users manage own notifications" on public.notifications for all using (
  user_id = auth.uid() or public.is_admin()
);

-- BRANDS & SIZE CHARTS
drop policy if exists "Brands public read" on public.brands;
create policy "Brands public read" on public.brands for select using (
  is_active = true or public.is_admin()
);

drop policy if exists "Admin manage brands" on public.brands;
create policy "Admin manage brands" on public.brands for all using (public.is_admin());

drop policy if exists "Size charts public read" on public.size_charts;
create policy "Size charts public read" on public.size_charts for select using (true);

drop policy if exists "Admin manage size charts" on public.size_charts;
create policy "Admin manage size charts" on public.size_charts for all using (public.is_admin());

-- STOCK MOVEMENTS, STATUS HISTORY & PRODUCT AUDIT LOGS
drop policy if exists "Shop and admin view stock movements" on public.stock_movements;
create policy "Shop and admin view stock movements" on public.stock_movements for select using (
  exists (
    select 1 from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.shops s on s.id = p.shop_id
    where pv.id = stock_movements.variant_id and s.owner_id = (select auth.uid())
  ) or public.is_admin()
);

drop policy if exists "Shop and admin insert stock movements" on public.stock_movements;
create policy "Shop and admin insert stock movements" on public.stock_movements for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.product_variants pv
      join public.products p on p.id = pv.product_id
      join public.shops s on s.id = p.shop_id
      where pv.id = stock_movements.variant_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  );

drop policy if exists "Read product status history" on public.product_status_history;
create policy "Read product status history" on public.product_status_history for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_status_history.product_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Insert product status history" on public.product_status_history;
create policy "Insert product status history" on public.product_status_history for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_status_history.product_id
        and s.owner_id = (select auth.uid())
        and s.kyc_status = 'approved'
    )
  );

drop policy if exists "Read product audit logs" on public.product_audit_logs;
create policy "Read product audit logs" on public.product_audit_logs for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.shops s
      where s.id = product_audit_logs.shop_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Insert product audit logs" on public.product_audit_logs;
create policy "Insert product audit logs" on public.product_audit_logs for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      actor_id = (select auth.uid())
      and exists (
        select 1 from public.shops s
        where s.id = product_audit_logs.shop_id
          and s.owner_id = (select auth.uid())
          and s.kyc_status = 'approved'
      )
    )
  );

-- ==============================================================================
-- STORAGE BUCKETS
-- ==============================================================================
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('kyc-documents', 'kyc-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('delivery-proofs', 'delivery-proofs', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('review-images', 'review-images', true) on conflict (id) do nothing;

drop policy if exists "Public read public buckets" on storage.objects;
create policy "Public read public buckets" on storage.objects for select using (
  bucket_id in ('product-images', 'delivery-proofs', 'review-images')
);

drop policy if exists "Authenticated upload objects" on storage.objects;
create policy "Authenticated upload objects" on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('product-images', 'kyc-documents', 'delivery-proofs', 'payment-proofs', 'review-images')
  );

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images" on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');
