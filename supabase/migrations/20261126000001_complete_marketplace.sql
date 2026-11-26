-- ==============================================================================
-- TRIO DEALERS - COMPLETE ENTERPRISE MARKETPLACE MIGRATION
-- Covers all 8 build phases: Multi-vendor Orders, Atomic Stock Lock, B2B Teams,
-- Returns/Refunds, Support/Chat, Flash Sales/Wallet/Loyalty, Homepage/CMS/Settings,
-- Full-Text/Trigram Search, Analytics Views, Storage Security, and Hardened RLS.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. SECURITY & ROLE HELPERS (fixed search_path, zero deprecated auth.role())
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_b2b_approved()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.b2b_accounts b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.user_id = (SELECT auth.uid())
      AND b.verification_status = 'approved'
      AND p.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- ==============================================================================
-- 2. SCHEMA EXTENSIONS TO EXISTING TABLES
-- ==============================================================================

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS per_user_limit integer NOT NULL DEFAULT 1;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT false;
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_scope_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_scope_check
  CHECK (scope IN ('global', 'shop', 'first_order', 'b2b_only', 'free_shipping', 'user_specific'));

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true;

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS return_window_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(fabric, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(pattern, '') || ' ' || coalesce(occasion, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_fts ON public.products USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_fabric_trgm ON public.products USING gin(fabric gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sales_count ON public.products(sales_count DESC);

-- ==============================================================================
-- 3. ADDITIONAL ENTERPRISE TABLES
-- ==============================================================================

-- B2B MULTI-USER TEAM MEMBERS
CREATE TABLE IF NOT EXISTS public.b2b_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  b2b_account_id uuid REFERENCES public.b2b_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_email text NOT NULL,
  member_name text NOT NULL,
  member_role text NOT NULL CHECK (member_role IN ('owner', 'approver', 'buyer')) DEFAULT 'buyer',
  approval_limit numeric(12,2) NOT NULL DEFAULT 25000.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (b2b_account_id, member_email)
);
CREATE INDEX IF NOT EXISTS idx_b2b_members_account ON public.b2b_members(b2b_account_id);
CREATE INDEX IF NOT EXISTS idx_b2b_members_user ON public.b2b_members(user_id);

-- TRANSPORTERS METADATA & SERVICE AREAS
CREATE TABLE IF NOT EXISTS public.transporters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  agency_name text NOT NULL,
  vehicle_number text,
  license_no text,
  hub_city text NOT NULL DEFAULT 'Surat',
  hub_state text NOT NULL DEFAULT 'Gujarat',
  is_available boolean NOT NULL DEFAULT true,
  rating numeric(3,2) NOT NULL DEFAULT 5.00,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_transporters_city ON public.transporters(hub_city);

CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pincode text NOT NULL UNIQUE,
  city text NOT NULL,
  state text NOT NULL,
  is_serviceable boolean NOT NULL DEFAULT true,
  cod_available boolean NOT NULL DEFAULT true,
  estimated_days integer NOT NULL DEFAULT 4 CHECK (estimated_days > 0),
  shipping_surcharge numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_service_areas_pincode ON public.service_areas(pincode);

-- DYNAMIC ATTRIBUTE TAXONOMY
CREATE TABLE IF NOT EXISTS public.attributes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_type text NOT NULL CHECK (attribute_type IN ('fabric', 'fit', 'pattern', 'occasion')),
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (attribute_type, slug)
);
CREATE INDEX IF NOT EXISTS idx_attributes_type ON public.attributes(attribute_type, sort_order);

-- USER ALERTS & RECENTLY VIEWED
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  target_price numeric(10,2),
  last_notified_price numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_prod ON public.price_alerts(product_id);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_variant ON public.stock_alerts(variant_id);

CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON public.recently_viewed(user_id, viewed_at DESC);

-- ATOMIC STOCK RESERVATIONS (for pending online payments)
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_stock_res_order ON public.stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_res_exp ON public.stock_reservations(expires_at) WHERE released_at IS NULL;

-- PAYMENTS, REFUNDS & RETURNS
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  gateway text NOT NULL CHECK (gateway IN ('razorpay', 'cod', 'bank_transfer', 'credit_terms', 'wallet')),
  gateway_order_id text,
  gateway_payment_id text,
  webhook_event_id text UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  method text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gw_order ON public.payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gw_pay ON public.payments(gateway_payment_id);

CREATE TABLE IF NOT EXISTS public.returns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE CASCADE NOT NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('return', 'exchange')) DEFAULT 'return',
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'picked_up', 'received', 'refunded')) DEFAULT 'requested',
  proof_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_returns_sub_order ON public.returns(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user ON public.returns(user_id);

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processed', 'failed')) DEFAULT 'pending',
  gateway_refund_id text,
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);

-- B2B SAVED LISTS & RECURRING ORDERS
CREATE TABLE IF NOT EXISTS public.saved_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  b2b_account_id uuid REFERENCES public.b2b_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON public.saved_lists(user_id);

CREATE TABLE IF NOT EXISTS public.recurring_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  b2b_account_id uuid REFERENCES public.b2b_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency_days integer NOT NULL DEFAULT 30 CHECK (frequency_days > 0),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_run_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_b2b ON public.recurring_orders(b2b_account_id);

-- COUPON USAGES, FLASH SALES & BUNDLES
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  discount_applied numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (coupon_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON public.coupon_usages(coupon_id, user_id);

CREATE TABLE IF NOT EXISTS public.flash_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON public.flash_sales(is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.bundles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  bundle_price numeric(12,2) NOT NULL CHECK (bundle_price > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_bundles_shop ON public.bundles(shop_id);

-- REVIEW MEDIA, PRODUCT Q&A, SHOP FOLLOWERS
CREATE TABLE IF NOT EXISTS public.review_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')) DEFAULT 'image',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_review_media_rev ON public.review_media(review_id);

CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text,
  answered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  answered_at timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_product_questions_prod ON public.product_questions(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_followers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (shop_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_followers_shop ON public.shop_followers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_user ON public.shop_followers(user_id);

-- LOYALTY, WALLET, GIFT CARDS, REFERRALS, COMMISSIONS
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  points_delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON public.loyalty_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_delta numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL CHECK (balance_after >= 0),
  entry_type text NOT NULL CHECK (entry_type IN ('credit_refund', 'credit_giftcard', 'credit_promo', 'debit_order', 'admin_adjustment')),
  reference_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON public.wallet_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  initial_amount numeric(10,2) NOT NULL CHECK (initial_amount > 0),
  balance numeric(10,2) NOT NULL CHECK (balance >= 0),
  issued_to_email text,
  redeemed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON public.gift_cards(code);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL UNIQUE,
  referral_code text NOT NULL,
  reward_points integer NOT NULL DEFAULT 250,
  status text NOT NULL CHECK (status IN ('pending', 'rewarded')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  rate_percent numeric(5,2) NOT NULL,
  gross_amount numeric(12,2) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_commissions_shop ON public.commissions(shop_id);

-- AD CAMPAIGNS, BANNERS, HOMEPAGE BUILDER, CMS, EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('homepage_top', 'catalog_featured', 'category_sponsor')),
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget numeric(12,2) NOT NULL DEFAULT 0.00,
  spent numeric(12,2) NOT NULL DEFAULT 0.00,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'ended')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_shop ON public.ad_campaigns(shop_id);

CREATE TABLE IF NOT EXISTS public.banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  badge_text text,
  cta_label text,
  cta_href text,
  image_url text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('hero', 'announcement', 'mid_promo', 'category_strip')) DEFAULT 'hero',
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_banners_active ON public.banners(placement, sort_order) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
  section_type text NOT NULL CHECK (section_type IN ('hero_banner', 'featured_categories', 'flash_sale', 'new_arrivals', 'best_sellers', 'top_shops', 'b2b_calculator', 'testimonials', 'custom_banner')),
  title text NOT NULL,
  subtitle text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_enabled boolean NOT NULL DEFAULT true,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_order ON public.homepage_sections(sort_order) WHERE is_enabled = true;

CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  meta_title text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT true,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key text NOT NULL UNIQUE,
  subject text NOT NULL,
  body_html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PUSH SUBSCRIPTIONS, SUPPORT, CHAT, FRAUD, AUDIT, DPDP, SETTINGS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_no text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_name text,
  contact_email text,
  contact_phone text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (shop_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_shop ON public.chat_threads(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_buyer ON public.chat_threads(buyer_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'cleared', 'confirmed_fraud')) DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON public.fraud_flags(status);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.dpdp_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'consent')),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')) DEFAULT 'pending',
  consent_version text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dpdp_user ON public.dpdp_requests(user_id);

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. COLUMN PROTECTION & IMMUTABLE LEDGER TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.guard_profile_escalation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized privilege modification detected.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_guard_profile_escalation ON public.profiles;
CREATE TRIGGER on_guard_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_escalation();

CREATE OR REPLACE FUNCTION public.guard_shop_kyc_fields()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.kyc_status := 'pending';
    NEW.commission_rate := 10.00;
    NEW.rating := 5.00;
    NEW.reviews_count := 0;
    NEW.is_featured := false;
    RETURN NEW;
  END IF;

  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'Only administrators may alter shop KYC status, commission rate, or featured placement.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_guard_shop_kyc_fields ON public.shops;
CREATE TRIGGER on_guard_shop_kyc_fields
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_kyc_fields();

CREATE OR REPLACE FUNCTION public.guard_b2b_verification_fields()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending';
    NEW.credit_limit := 0.00;
    NEW.credit_balance := 0.00;
    NEW.payment_terms := 'prepaid';
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.credit_balance IS DISTINCT FROM OLD.credit_balance
     OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms THEN
    RAISE EXCEPTION 'Only administrators may alter B2B verification status, credit limit, or payment terms.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_guard_b2b_verification_fields ON public.b2b_accounts;
CREATE TRIGGER on_guard_b2b_verification_fields
  BEFORE INSERT OR UPDATE ON public.b2b_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_b2b_verification_fields();

-- Append-only enforcement for audit and financial ledgers
CREATE OR REPLACE FUNCTION public.guard_append_only_ledger()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ledger and audit tables are strictly append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER on_immutable_audit_logs BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

DROP TRIGGER IF EXISTS on_immutable_shop_ledger ON public.shop_ledger;
CREATE TRIGGER on_immutable_shop_ledger BEFORE UPDATE OR DELETE ON public.shop_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

DROP TRIGGER IF EXISTS on_immutable_b2b_ledger ON public.b2b_credit_ledger;
CREATE TRIGGER on_immutable_b2b_ledger BEFORE UPDATE OR DELETE ON public.b2b_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

DROP TRIGGER IF EXISTS on_immutable_wallet_ledger ON public.wallet_ledger;
CREATE TRIGGER on_immutable_wallet_ledger BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

DROP TRIGGER IF EXISTS on_immutable_loyalty_ledger ON public.loyalty_ledger;
CREATE TRIGGER on_immutable_loyalty_ledger BEFORE UPDATE OR DELETE ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

DROP TRIGGER IF EXISTS on_immutable_commissions ON public.commissions;
CREATE TRIGGER on_immutable_commissions BEFORE UPDATE OR DELETE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_ledger();

-- ==============================================================================
-- 5. TRANSACTIONAL CHECKOUT RPC WITH ROW LOCKS (prevents race/oversell/tampering)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.place_marketplace_order(
  p_user_id uuid,
  p_items jsonb, -- [{"product_id": "...", "variant_id": "...", "quantity": 2}]
  p_address_snapshot jsonb,
  p_payment_method text,
  p_payment_proof_url text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_use_wallet boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_profile RECORD;
  v_b2b RECORD;
  v_is_b2b boolean := false;
  v_is_shop boolean := false;
  v_order_type text := 'retail';
  v_item jsonb;
  v_prod RECORD;
  v_variant RECORD;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_gst_rate numeric(5,2);
  v_tax numeric(12,2);
  v_slab_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_shipping_total numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_wallet_used numeric(12,2) := 0;
  v_wallet_balance numeric(12,2) := 0;
  v_coupon RECORD;
  v_user_coupon_count integer := 0;
  v_total_orders_count integer := 0;
  v_total_amount numeric(12,2) := 0;
  v_order_no text;
  v_order_id uuid;
  v_shop_id uuid;
  v_sub_id uuid;
  v_sub_no text;
  v_comm_rate numeric(5,2);
  v_comm_amount numeric(12,2);
  v_shop_earnings numeric(12,2);
  v_shop_idx integer := 0;
  v_delivery_state text;
  v_shop_state text;
  v_free_ship_threshold numeric(12,2) := 1999.00;
  v_base_ship_fee numeric(12,2) := 150.00;
  v_shipping_cfg jsonb;
  v_alpha text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_sub_totals RECORD;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART: Order items cannot be empty.';
  END IF;

  SELECT id, role, is_active INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR v_profile.is_active = false THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: User account is inactive.';
  END IF;

  SELECT * INTO v_b2b FROM public.b2b_accounts WHERE user_id = p_user_id;
  IF FOUND AND v_profile.role = 'b2b' AND v_b2b.verification_status = 'approved' THEN
    v_is_b2b := true;
    v_order_type := 'b2b';
  ELSIF v_profile.role = 'shop' THEN
    v_is_shop := EXISTS (SELECT 1 FROM public.shops WHERE owner_id = p_user_id AND kyc_status = 'approved');
  END IF;

  -- Load dynamic shipping threshold from settings if configured
  SELECT value INTO v_shipping_cfg FROM public.settings WHERE key = 'shipping_rules' LIMIT 1;
  IF v_shipping_cfg IS NOT NULL THEN
    v_free_ship_threshold := coalesce((v_shipping_cfg->>'free_shipping_threshold')::numeric, 1999.00);
    v_base_ship_fee := coalesce((v_shipping_cfg->>'flat_shipping_fee')::numeric, 150.00);
  END IF;

  v_delivery_state := lower(trim(coalesce(p_address_snapshot->>'state', '')));

  -- Temporary staging table for validated lines inside this transaction
  CREATE TEMP TABLE IF NOT EXISTS _tmp_checkout_lines (
    shop_id uuid,
    shop_state text,
    commission_rate numeric(5,2),
    product_id uuid,
    variant_id uuid,
    product_name text,
    variant_info text,
    hsn_code text,
    unit_price numeric(12,2),
    quantity integer,
    line_total numeric(12,2),
    tax_amount numeric(12,2),
    is_interstate boolean
  ) ON COMMIT DROP;
  TRUNCATE TABLE _tmp_checkout_lines;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY: Item quantity must be positive.';
    END IF;

    -- Lock variant row first to prevent concurrent stock race conditions
    SELECT * INTO v_variant
    FROM public.product_variants
    WHERE id = (v_item->>'variant_id')::uuid AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND: Selected variant is unavailable.';
    END IF;

    IF v_variant.stock_qty < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: Insufficient stock for variant %.', v_variant.sku;
    END IF;

    SELECT p.*, s.kyc_status AS shop_kyc, s.state AS shop_state, s.commission_rate AS shop_comm, c.commission_override
    INTO v_prod
    FROM public.products p
    JOIN public.shops s ON s.id = p.shop_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = v_variant.product_id AND p.id = (v_item->>'product_id')::uuid;

    IF NOT FOUND
       OR v_prod.is_archived = true
       OR v_prod.deleted_at IS NOT NULL
       OR v_prod.is_active = false
       OR v_prod.approval_status <> 'approved'
       OR v_prod.shop_kyc <> 'approved' THEN
      RAISE EXCEPTION 'UNAVAILABLE_PRODUCT: Product % is no longer available.', coalesce(v_prod.name, 'item');
    END IF;

    v_unit_price := v_prod.retail_price;
    IF (v_is_b2b OR v_is_shop) AND v_prod.sell_b2b = true THEN
      SELECT ps.unit_price INTO v_slab_price
      FROM public.price_slabs ps
      WHERE ps.product_id = v_prod.id AND ps.min_qty <= v_qty
      ORDER BY ps.min_qty DESC
      LIMIT 1;

      IF v_slab_price IS NOT NULL THEN
        v_unit_price := v_slab_price;
      END IF;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_gst_rate := coalesce(v_prod.gst_rate, 5.00);
    v_tax := round((v_line_total * v_gst_rate) / 100.0, 2);
    v_shop_state := lower(trim(coalesce(v_prod.shop_state, 'gujarat')));
    v_comm_rate := coalesce(v_prod.commission_override, v_prod.shop_comm, 10.00);

    INSERT INTO _tmp_checkout_lines VALUES (
      v_prod.shop_id,
      v_shop_state,
      v_comm_rate,
      v_prod.id,
      v_variant.id,
      v_prod.name,
      v_variant.color || ' (' || v_variant.size || ')',
      coalesce(v_prod.hsn_code, '5007'),
      v_unit_price,
      v_qty,
      v_line_total,
      v_tax,
      (v_delivery_state <> '' AND v_delivery_state <> v_shop_state)
    );

    -- Atomically reserve/deduct stock
    UPDATE public.product_variants
    SET stock_qty = stock_qty - v_qty
    WHERE id = v_variant.id;

    UPDATE public.products
    SET sales_count = sales_count + v_qty
    WHERE id = v_prod.id;
  END LOOP;

  -- Aggregate totals by shop
  FOR v_sub_totals IN
    SELECT shop_id, sum(line_total) AS grp_sub, sum(tax_amount) AS grp_tax
    FROM _tmp_checkout_lines
    GROUP BY shop_id
  LOOP
    v_subtotal := v_subtotal + v_sub_totals.grp_sub;
    v_tax_total := v_tax_total + v_sub_totals.grp_tax;
    IF v_sub_totals.grp_sub < v_free_ship_threshold THEN
      v_shipping_total := v_shipping_total + v_base_ship_fee;
    END IF;
  END LOOP;

  -- Validate coupon atomically with FOR UPDATE lock
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE code = upper(trim(p_coupon_code)) AND is_active = true
    FOR UPDATE;

    IF NOT FOUND OR now() < v_coupon.valid_from OR now() > v_coupon.valid_to THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon is inactive or expired.';
    END IF;

    IF v_coupon.times_used >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'COUPON_LIMIT_EXCEEDED: Coupon global limit reached.';
    END IF;

    SELECT count(*) INTO v_user_coupon_count
    FROM public.coupon_usages
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

    IF v_user_coupon_count >= v_coupon.per_user_limit THEN
      RAISE EXCEPTION 'COUPON_LIMIT_EXCEEDED: You have already redeemed this coupon.';
    END IF;

    IF v_coupon.scope = 'b2b_only' AND NOT v_is_b2b THEN
      RAISE EXCEPTION 'COUPON_INVALID: This coupon is reserved for verified B2B buyers.';
    END IF;

    IF v_coupon.scope = 'user_specific' AND v_coupon.target_user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'COUPON_INVALID: This coupon is not assigned to your account.';
    END IF;

    IF v_coupon.scope = 'first_order' THEN
      SELECT count(*) INTO v_total_orders_count FROM public.orders WHERE user_id = p_user_id AND status <> 'cancelled';
      IF v_total_orders_count > 0 THEN
        RAISE EXCEPTION 'COUPON_INVALID: First-order coupon is only valid on your initial purchase.';
      END IF;
    END IF;

    IF v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'COUPON_INVALID: Minimum order value not met for coupon.';
    END IF;

    IF v_coupon.scope = 'free_shipping' THEN
      v_discount := v_shipping_total;
    ELSIF v_coupon.discount_type = 'percentage' THEN
      v_discount := least(round((v_subtotal * v_coupon.discount_value) / 100.0, 2), v_coupon.max_discount);
    ELSE
      v_discount := least(v_coupon.discount_value, v_subtotal);
    END IF;
  END IF;

  v_total_amount := greatest(0, v_subtotal + v_tax_total + v_shipping_total - v_discount);

  -- Optional Wallet Credit Deduction
  IF p_use_wallet THEN
    SELECT coalesce(balance_after, 0) INTO v_wallet_balance
    FROM public.wallet_ledger
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_wallet_balance > 0 THEN
      v_wallet_used := least(v_wallet_balance, v_total_amount);
      v_total_amount := greatest(0, v_total_amount - v_wallet_used);
    END IF;
  END IF;

  -- Validate B2B Trade Credit Terms
  IF p_payment_method = 'credit_terms' THEN
    IF NOT v_is_b2b THEN
      RAISE EXCEPTION 'CREDIT_UNAUTHORIZED: Trade credit requires an approved B2B account.';
    END IF;
    IF v_b2b.payment_terms = 'prepaid' THEN
      RAISE EXCEPTION 'CREDIT_UNAUTHORIZED: Account is currently limited to prepaid terms.';
    END IF;
    SELECT credit_balance INTO v_b2b.credit_balance FROM public.b2b_accounts WHERE id = v_b2b.id FOR UPDATE;
    IF v_b2b.credit_balance < v_total_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDIT: Insufficient trade credit limit remaining.';
    END IF;
  END IF;

  v_order_no := 'TD-' || to_char(now(), 'YYYYMM') || '-' || lpad(floor(10000 + random() * 89999)::text, 5, '0');

  INSERT INTO public.orders (
    order_no, user_id, order_type, status, payment_method, payment_status,
    subtotal, shipping_fee, tax_total, discount_amount, total_amount,
    coupon_id, address_snapshot, payment_proof_url, notes
  ) VALUES (
    v_order_no, p_user_id, v_order_type, 'placed', p_payment_method,
    CASE WHEN p_payment_method = 'credit_terms' OR v_total_amount = 0 THEN 'paid' ELSE 'pending' END,
    v_subtotal, v_shipping_total, v_tax_total, v_discount, v_total_amount,
    CASE WHEN v_coupon.id IS NOT NULL THEN v_coupon.id ELSE NULL END,
    p_address_snapshot, p_payment_proof_url, p_notes
  )
  RETURNING id INTO v_order_id;

  -- Record coupon usage
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_usages (coupon_id, user_id, order_id, discount_applied)
    VALUES (v_coupon.id, p_user_id, v_order_id, v_discount);

    UPDATE public.coupons SET times_used = times_used + 1 WHERE id = v_coupon.id;
  END IF;

  -- Record wallet debit
  IF v_wallet_used > 0 THEN
    INSERT INTO public.wallet_ledger (user_id, amount_delta, balance_after, entry_type, reference_id, note)
    VALUES (
      p_user_id, -v_wallet_used, v_wallet_balance - v_wallet_used,
      'debit_order', v_order_id::text, 'Applied toward order ' || v_order_no
    );
  END IF;

  -- Record B2B credit debit
  IF p_payment_method = 'credit_terms' THEN
    UPDATE public.b2b_accounts
    SET credit_balance = credit_balance - v_total_amount, updated_at = timezone('utc'::text, now())
    WHERE id = v_b2b.id;

    INSERT INTO public.b2b_credit_ledger (b2b_account_id, type, amount, balance_after, reference_order_id)
    VALUES (v_b2b.id, 'credit_used', v_total_amount, v_b2b.credit_balance - v_total_amount, v_order_id);
  END IF;

  -- Create per-shop sub-orders, items, commission records & reservations
  FOR v_sub_totals IN
    SELECT shop_id, max(commission_rate) AS comm_rate, sum(line_total) AS grp_sub, sum(tax_amount) AS grp_tax
    FROM _tmp_checkout_lines
    GROUP BY shop_id
  LOOP
    v_shop_idx := v_shop_idx + 1;
    v_sub_no := v_order_no || '-' || substr(v_alpha, ((v_shop_idx - 1) % 26) + 1, 1);
    v_shipping_total := CASE WHEN v_sub_totals.grp_sub >= v_free_ship_threshold THEN 0 ELSE v_base_ship_fee END;
    v_comm_rate := coalesce(v_sub_totals.comm_rate, 10.00);
    v_comm_amount := round((v_sub_totals.grp_sub * v_comm_rate) / 100.0, 2);
    v_shop_earnings := greatest(0, (v_sub_totals.grp_sub + v_sub_totals.grp_tax + v_shipping_total) - v_comm_amount);

    INSERT INTO public.sub_orders (
      parent_order_id, shop_id, sub_order_no, status,
      subtotal, shipping_fee, tax_total, total,
      commission_amount, shop_earnings, invoice_no
    ) VALUES (
      v_order_id, v_sub_totals.shop_id, v_sub_no, 'placed',
      v_sub_totals.grp_sub, v_shipping_total, v_sub_totals.grp_tax,
      (v_sub_totals.grp_sub + v_sub_totals.grp_tax + v_shipping_total),
      v_comm_amount, v_shop_earnings,
      'INV-' || to_char(now(), 'YYYY') || '-' || lpad(floor(10000 + random() * 89999)::text, 5, '0')
    )
    RETURNING id INTO v_sub_id;

    INSERT INTO public.order_items (
      sub_order_id, variant_id, product_id, product_name, variant_info, hsn_code,
      unit_price, quantity, line_total, cgst, sgst, igst
    )
    SELECT
      v_sub_id, l.variant_id, l.product_id, l.product_name, l.variant_info, l.hsn_code,
      l.unit_price, l.quantity, l.line_total,
      CASE WHEN l.is_interstate THEN 0 ELSE round(l.tax_amount / 2.0, 2) END,
      CASE WHEN l.is_interstate THEN 0 ELSE round(l.tax_amount / 2.0, 2) END,
      CASE WHEN l.is_interstate THEN l.tax_amount ELSE 0 END
    FROM _tmp_checkout_lines l
    WHERE l.shop_id = v_sub_totals.shop_id;

    INSERT INTO public.order_status_history (sub_order_id, status, note, changed_by)
    VALUES (v_sub_id, 'placed', 'Order placed via atomic checkout', p_user_id);

    INSERT INTO public.commissions (sub_order_id, shop_id, rate_percent, gross_amount, commission_amount)
    VALUES (v_sub_id, v_sub_totals.shop_id, v_comm_rate, v_sub_totals.grp_sub, v_comm_amount);

    IF p_payment_method = 'razorpay' THEN
      INSERT INTO public.stock_reservations (order_id, variant_id, quantity, expires_at)
      SELECT v_order_id, l.variant_id, l.quantity, now() + interval '20 minutes'
      FROM _tmp_checkout_lines l WHERE l.shop_id = v_sub_totals.shop_id;
    END IF;
  END LOOP;

  -- Prevent double trigger deduction since atomic RPC already deducted stock
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'total_amount', v_total_amount,
    'subtotal', v_subtotal,
    'tax_total', v_tax_total,
    'shipping_fee', v_shipping_total,
    'discount_amount', v_discount,
    'wallet_used', v_wallet_used
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Release stock when order_items trigger would otherwise double-deduct:
-- keep trigger safe ONLY for legacy direct inserts outside atomic RPC using transaction GUC or flag:
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order()
RETURNS trigger AS $$
BEGIN
  -- If called from place_marketplace_order temp table context, skip duplicate deduction; still log stock_movement
  IF new.variant_id IS NOT NULL THEN
    IF to_regclass('pg_temp._tmp_checkout_lines') IS NULL THEN
      UPDATE public.product_variants
      SET stock_qty = greatest(0, stock_qty - new.quantity)
      WHERE id = new.variant_id;
    END IF;

    INSERT INTO public.stock_movements (variant_id, change_qty, reason, reference_id)
    VALUES (new.variant_id, -new.quantity, 'order_deduction', new.sub_order_id::text);
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==============================================================================
-- 6. ANALYTICS VIEWS (security_invoker = true) & MATERIALIZED VIEWS
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_shop_performance
WITH (security_invoker = true) AS
SELECT
  s.id AS shop_id,
  s.shop_name,
  s.slug,
  s.kyc_status,
  count(so.id) AS total_sub_orders,
  coalesce(sum(so.total) FILTER (WHERE so.status NOT IN ('cancelled', 'returned')), 0) AS gross_gmv,
  coalesce(sum(so.commission_amount) FILTER (WHERE so.status NOT IN ('cancelled', 'returned')), 0) AS total_commission,
  coalesce(sum(so.shop_earnings) FILTER (WHERE so.status NOT IN ('cancelled', 'returned')), 0) AS net_earnings
FROM public.shops s
LEFT JOIN public.sub_orders so ON so.shop_id = s.id
GROUP BY s.id, s.shop_name, s.slug, s.kyc_status;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_best_sellers AS
SELECT
  p.id AS product_id,
  p.slug,
  p.name,
  p.shop_id,
  p.category_id,
  p.sales_count,
  coalesce(sum(oi.quantity), 0)::integer AS ordered_units,
  coalesce(avg(r.rating), 5.0)::numeric(3,2) AS avg_rating,
  count(DISTINCT r.id)::integer AS review_count
FROM public.products p
LEFT JOIN public.order_items oi ON oi.product_id = p.id
LEFT JOIN public.reviews r ON r.product_id = p.id
WHERE p.approval_status = 'approved'
  AND p.is_active = true
  AND p.is_archived = false
  AND p.deleted_at IS NULL
GROUP BY p.id, p.slug, p.name, p.shop_id, p.category_id, p.sales_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_best_sellers_id ON public.mv_best_sellers(product_id);

-- ==============================================================================
-- 7. FULL RLS POLICIES FOR ALL NEW TABLES (strict deny-by-default)
-- ==============================================================================

ALTER TABLE public.b2b_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Public readable dynamic catalog/CMS tables (no sensitive PII)
CREATE POLICY "Public read active service areas" ON public.service_areas FOR SELECT TO anon, authenticated USING (is_serviceable = true OR public.is_admin());
CREATE POLICY "Admin manage service areas" ON public.service_areas FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read attributes" ON public.attributes FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin manage attributes" ON public.attributes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read flash sales" ON public.flash_sales FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin manage flash sales" ON public.flash_sales FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read bundles" ON public.bundles FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin manage bundles" ON public.bundles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read banners" ON public.banners FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin manage banners" ON public.banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read homepage sections" ON public.homepage_sections FOR SELECT TO anon, authenticated USING (is_enabled = true OR public.is_admin());
CREATE POLICY "Admin manage homepage sections" ON public.homepage_sections FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read cms pages" ON public.cms_pages FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin());
CREATE POLICY "Admin manage cms pages" ON public.cms_pages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read settings marked public" ON public.settings FOR SELECT TO anon, authenticated USING (is_public = true OR public.is_admin());
CREATE POLICY "Admin manage settings" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin manage email templates" ON public.email_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- User-scoped records
CREATE POLICY "User manage own alerts" ON public.price_alerts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User manage own stock alerts" ON public.stock_alerts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User manage own recently viewed" ON public.recently_viewed FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User manage own push" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User manage own saved lists" ON public.saved_lists FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "B2B manage own recurring orders" ON public.recurring_orders FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User read own wallet" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User read own loyalty" ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User read own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = (SELECT auth.uid()) OR referred_user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "User manage own dpdp requests" ON public.dpdp_requests FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- B2B members & Transporters
CREATE POLICY "B2B members owner or admin" ON public.b2b_members FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.b2b_accounts b WHERE b.id = b2b_members.b2b_account_id AND b.user_id = (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.b2b_accounts b WHERE b.id = b2b_members.b2b_account_id AND b.user_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "Transporter view own or admin" ON public.transporters FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage transporters" ON public.transporters FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Payments, Refunds, Returns, Coupon Usages, Reservations, Commissions
CREATE POLICY "View own payments" ON public.payments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "View own or shop refunds" ON public.refunds FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.sub_orders so JOIN public.shops s ON s.id = so.shop_id WHERE so.id = refunds.sub_order_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  );
CREATE POLICY "Admin manage refunds" ON public.refunds FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Buyer shop admin manage returns" ON public.returns FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.sub_orders so JOIN public.shops s ON s.id = so.shop_id WHERE so.id = returns.sub_order_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.sub_orders so JOIN public.shops s ON s.id = so.shop_id WHERE so.id = returns.sub_order_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "Read own coupon usages" ON public.coupon_usages FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "View own reservations" ON public.stock_reservations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = stock_reservations.order_id AND o.user_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "Shop view own commissions" ON public.commissions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = commissions.shop_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "User read own gift cards" ON public.gift_cards FOR SELECT TO authenticated
  USING (redeemed_by = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage gift cards" ON public.gift_cards FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Q&A, Review Media, Shop Followers, Ad Campaigns
CREATE POLICY "Public read published product Q&A" ON public.product_questions FOR SELECT TO anon, authenticated
  USING (is_published = true OR user_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "Auth users ask questions" ON public.product_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Shop owner and admin answer questions" ON public.product_questions FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_questions.product_id AND s.owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_questions.product_id AND s.owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "Public read review media" ON public.review_media FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users add review media" ON public.review_media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_media.review_id AND r.user_id = (SELECT auth.uid())));

CREATE POLICY "Public count followers" ON public.shop_followers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users toggle follow shop" ON public.shop_followers FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Shop manage own ad campaigns" ON public.ad_campaigns FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_campaigns.shop_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_campaigns.shop_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

-- Support Tickets, Chat, Fraud Flags, Audit Logs
CREATE POLICY "User and admin manage tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Ticket participants read messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      is_internal = false
      AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = (SELECT auth.uid()))
    )
  );
CREATE POLICY "Ticket participants post messages" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Chat participants manage threads" ON public.chat_threads FOR ALL TO authenticated
  USING (
    buyer_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = chat_threads.shop_id AND s.owner_id = (SELECT auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    buyer_id = (SELECT auth.uid()) OR public.is_admin()
  );

CREATE POLICY "Chat participants manage messages" ON public.chat_messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads ct
      LEFT JOIN public.shops s ON s.id = ct.shop_id
      WHERE ct.id = chat_messages.thread_id
        AND (ct.buyer_id = (SELECT auth.uid()) OR s.owner_id = (SELECT auth.uid()))
    )
    OR public.is_admin()
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads ct
      LEFT JOIN public.shops s ON s.id = ct.shop_id
      WHERE ct.id = chat_messages.thread_id
        AND (ct.buyer_id = (SELECT auth.uid()) OR s.owner_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Admin only fraud flags" ON public.fraud_flags FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR actor_id = (SELECT auth.uid()));

-- ==============================================================================
-- 8. STORAGE HARDENING: Private Proof/KYC Buckets + Folder Isolation
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('review-images', 'review-images', true),
  ('kyc-documents', 'kyc-documents', false),
  ('delivery-proofs', 'delivery-proofs', false),
  ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read public buckets" ON storage.objects;
CREATE POLICY "Public read public buckets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('product-images', 'review-images'));

DROP POLICY IF EXISTS "Authorized read private buckets" ON storage.objects;
CREATE POLICY "Authorized read private buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('kyc-documents', 'delivery-proofs', 'payment-proofs')
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "Authenticated upload objects" ON storage.objects;
CREATE POLICY "Authenticated upload objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('product-images', 'review-images', 'kyc-documents', 'delivery-proofs', 'payment-proofs')
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR bucket_id = 'product-images'
    )
  );

-- ==============================================================================
-- 9. DEFAULT SYSTEM CONFIGURATION SEED (editable in Admin Panel)
-- ==============================================================================

INSERT INTO public.settings (key, value, is_public, description)
VALUES
  ('store_profile', '{"brand_name":"Trio Dealers","tagline":"Retail & Wholesale Cloth Merchants","whatsapp_number":"919876543210","support_email":"concierge@triodealers.in","hq_address":"Millennium Textile Hub, Ring Road, Surat, Gujarat 395002","gstin":"24AABCT1234F1Z8","announcement_bar":"FREE INSURED FREIGHT ON ORDERS ABOVE ₹1,999 • DIRECT SURAT MILL DISPATCH"}', true, 'Public storefront branding & contact details'),
  ('shipping_rules', '{"free_shipping_threshold":1999,"flat_shipping_fee":150,"default_return_window_days":7}', true, 'Marketplace shipping and return policy settings'),
  ('payment_toggles', '{"razorpay_enabled":true,"cod_enabled":true,"bank_transfer_enabled":true,"b2b_credit_terms_enabled":true,"wallet_enabled":true}', true, 'Enabled payment methods across checkout'),
  ('feature_flags', '{"phone_otp_enabled":false,"google_retail_login_enabled":true,"b2b_rfq_enabled":true,"live_chat_enabled":true,"loyalty_program_enabled":true}', true, 'Platform feature toggles'),
  ('upi_settlement_display', '{"upi_id":"triodealers@upi","bank_name":"HDFC Bank Ltd","account_masked":"••••5678","ifsc":"HDFC0001234"}', true, 'Masked bank details displayed for manual transfer')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.cms_pages (slug, title, content_html, meta_title, meta_description, is_published)
VALUES
  ('about', 'About Trio Dealers', '<h2>Surat Heritage Meets Modern Textile Trade</h2><p>Trio Dealers bridges master looms across Surat, Varanasi, Kanchipuram, and Bhagalpur directly with individual shoppers and wholesale boutiques.</p>', 'About Trio Dealers', 'India''s luxury multi-vendor retail and B2B wholesale textile marketplace.', true),
  ('faq', 'Frequently Asked Questions', '<h3>How do B2B wholesale slabs apply?</h3><p>Verified GST buyers receive tiered quantity discounts automatically on qualifying SKUs.</p><h3>Are orders insured?</h3><p>Every consignment parcel carries two-leg OTP verification from mill pickup to final delivery.</p>', 'FAQ — Trio Dealers', 'Answers for retail buyers, wholesale partners, and seller mills.', true),
  ('shipping', 'Shipping & Dispatch Policy', '<p>Confirmed orders received before 4:00 PM IST are dispatched via partner freight networks with live sub-order tracking and GST tax invoices.</p>', 'Shipping Policy — Trio Dealers', 'Pan-India textile dispatch and freight timelines.', true),
  ('returns', 'Returns & Exchange Policy', '<p>Eligible items may be returned within the configured return window for quality inspection and instant wallet or gateway refund.</p>', 'Returns Policy — Trio Dealers', 'Return, exchange, and refund terms.', true),
  ('privacy', 'Privacy Policy (DPDP Act Compliant)', '<p>We collect only essential order, KYC, and delivery information. Users can export or request deletion of their personal data from Account Privacy Settings.</p>', 'Privacy Policy — Trio Dealers', 'Data protection and DPDP privacy commitments.', true),
  ('terms', 'Terms & Conditions', '<p>Use of the Trio Dealers multi-vendor platform is governed by Surat jurisdiction commercial terms and seller KYC compliance standards.</p>', 'Terms of Service — Trio Dealers', 'Marketplace commercial terms of use.', true)
ON CONFLICT (slug) DO NOTHING;

