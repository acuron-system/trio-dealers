export type UserRole = 'admin' | 'shop' | 'b2b' | 'transporter' | 'user';

export type KycStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type B2BVerificationStatus = 'pending' | 'approved' | 'rejected';
export type ProductApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type ParentOrderStatus =
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'Placed'
  | 'Confirmed'
  | 'Packed'
  | 'Assigned to Transporter'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned';

export type OrderStatus = ParentOrderStatus;

export type SubOrderStatus =
  | 'placed'
  | 'accepted'
  | 'packed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type PaymentMethod = 'razorpay' | 'cod' | 'bank_transfer' | 'credit_terms';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type DeliveryLeg = 'pickup' | 'delivery';
export type DeliveryStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
export type RfqStatus = 'requested' | 'quoted' | 'accepted' | 'rejected' | 'expired';

export interface Profile {
  id: string;
  email?: string | null;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
  updated_at?: string;
  // Compatibility & UI fields
  is_approved?: boolean;
  shop_name?: string | null;
  gst_no?: string | null;
  credit_balance?: number;
  disabled?: boolean;
}

export interface Shop {
  id: string;
  owner_id: string;
  shop_name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  gstin: string | null;
  pan: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  kyc_status: KycStatus;
  kyc_doc_url?: string | null;
  commission_rate: number; // e.g. 10.0 for 10%
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at?: string;
  owner?: Profile;
}

export interface B2BAccount {
  id: string;
  user_id: string;
  business_name: string;
  gstin: string;
  pan?: string | null;
  trade_license_url?: string | null;
  verification_status: B2BVerificationStatus;
  credit_limit: number;
  credit_balance: number;
  payment_terms: 'prepaid' | 'net15' | 'net30';
  created_at: string;
  updated_at?: string;
  user?: Profile;
}

export interface Address {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  address_type: 'home' | 'business' | 'warehouse';
  created_at?: string;
}

export interface Category {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  image_url: string | null;
  commission_override?: number | null;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface SizeChartData {
  columns: string[];
  rows: string[][];
}

export interface SizeChart {
  id: string;
  name: string;
  category_id?: string | null;
  chart: SizeChartData;
  created_at?: string;
  category?: Category | null;
}

export type ProductAudience = 'men' | 'women' | 'kids' | 'unisex';

export interface PriceSlab {
  id: string;
  product_id: string;
  min_qty: number;
  unit_price: number;
  created_at?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex?: string | null;
  sku: string | null;
  stock_qty: number;
  low_stock_threshold?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  variant_color?: string | null;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_cover?: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  shop_id?: string;
  category_id?: string | null;
  brand_id?: string | null;
  size_chart_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  care_instructions?: string | null;
  video_url?: string | null;
  fabric?: string | null;
  fit?: string | null;
  pattern?: string | null;
  occasion?: string | null;
  audience?: ProductAudience | null;
  hsn_code?: string | null;
  gst_rate?: number; // e.g. 5.0 for 5%
  mrp?: number;
  retail_price: number;
  b2b_moq?: number;
  sell_retail?: boolean;
  sell_b2b?: boolean;
  approval_status?: ProductApprovalStatus;
  moderation_note?: string | null;
  is_active: boolean;
  is_archived?: boolean;
  archived_reason?: string | null;
  deleted_at?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined relations
  shop?: Shop;
  category?: Category | null;
  brand?: Brand | null;
  size_chart?: SizeChart | null;
  variants?: ProductVariant[];
  price_slabs?: PriceSlab[];
  wholesale_prices?: Array<{ id: string; product_id: string; min_qty: number; price: number }>;
  images?: ProductImage[];
  reviews?: Review[];
}

export interface ProductStatusHistory {
  id: string;
  product_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by?: string | null;
  note?: string | null;
  created_at: string;
  actor?: Profile | null;
}

export type StockMovementReason =
  | 'initial'
  | 'manual_adjust'
  | 'manual_restock'
  | 'import'
  | 'order_deduction'
  | 'return_restock'
  | 'sale'
  | 'return';

export interface StockMovement {
  id: string;
  variant_id: string;
  change_qty: number;
  reason: StockMovementReason;
  reference_id?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  variant?: ProductVariant & {
    product?: Pick<Product, 'id' | 'name' | 'slug' | 'shop_id'>;
  };
  actor?: Profile | null;
}

export type ProductAuditAction =
  | 'created'
  | 'submitted'
  | 'edited'
  | 'edited_resubmitted'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'unpublished'
  | 'published'
  | 'archived'
  | 'restored'
  | 'deleted'
  | 'bulk_imported';

export interface ProductAuditLog {
  id: string;
  product_id?: string | null;
  product_name: string;
  shop_id?: string | null;
  actor_id?: string | null;
  actor_role: string;
  action: ProductAuditAction;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  actor?: Profile | null;
  shop?: Shop | null;
}

export interface CartItem {
  id: string;
  user_id: string;
  variant_id: string;
  quantity: number;
  buyer_type: 'retail' | 'b2b';
  created_at?: string;
  variant?: ProductVariant & {
    product: Product & {
      shop: Shop;
    };
  };
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount: number;
  usage_limit: number;
  times_used: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export type OrderType = 'retail' | 'b2b' | 'wholesale';

export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  order_type: OrderType;
  status: ParentOrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  shipping_fee: number;
  tax_total: number;
  discount_amount: number;
  total_amount: number;
  coupon_id?: string | null;
  total?: number;
  shipping?: number;
  items?: any[];
  history?: any[];
  transporter_id?: string | null;
  address_snapshot: {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    buyer_gstin?: string | null;
  };
  payment_proof_url?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  sub_orders?: SubOrder[];
  profile?: Profile;
}

export interface SubOrder {
  id: string;
  parent_order_id: string;
  shop_id: string;
  sub_order_no: string;
  status: SubOrderStatus;
  subtotal: number;
  shipping_fee: number;
  tax_total: number;
  total: number;
  commission_amount: number;
  shop_earnings: number;
  transporter_id?: string | null;
  invoice_no?: string | null;
  packing_slip_url?: string | null;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  shop?: Shop;
  transporter?: Profile;
  deliveries?: Delivery[];
  history?: OrderStatusHistory[];
  parent_order?: Order;
}

export interface OrderItem {
  id: string;
  sub_order_id: string;
  variant_id?: string | null;
  product_id?: string | null;
  product_name: string;
  variant_info: string | null;
  hsn_code: string | null;
  unit_price: number;
  price?: number;
  quantity: number;
  line_total: number;
  total?: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface OrderStatusHistory {
  id: string;
  sub_order_id: string;
  status: SubOrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  sub_order_id: string;
  transporter_id: string;
  leg: DeliveryLeg;
  status: DeliveryStatus;
  failure_reason?: string | null;
  proof_url?: string | null;
  otp_code?: string | null;
  cod_amount: number;
  cod_collected: boolean;
  created_at: string;
  updated_at?: string;
  sub_order?: SubOrder;
  transporter?: Profile;
}

export interface RfqRequest {
  id: string;
  b2b_account_id: string;
  product_id: string;
  shop_id?: string;
  quantity: number;
  target_price?: number | null;
  notes?: string | null;
  status: RfqStatus;
  created_at: string;
  product?: Product;
  shop?: Shop;
  b2b_account?: B2BAccount;
  quotes?: RfqQuote[];
}

export interface RfqQuote {
  id: string;
  rfq_id: string;
  quoted_price: number;
  min_qty: number;
  valid_until: string;
  remarks?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string;
  image_url?: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  user?: Profile;
}

export interface ShopLedger {
  id: string;
  shop_id: string;
  sub_order_id?: string | null;
  type: 'order_credit' | 'commission_debit' | 'payout_debit' | 'refund_debit';
  amount: number;
  balance_after: number;
  note?: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  shop_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'settled' | 'failed';
  reference_id?: string | null;
  bank_details: {
    bank_name: string;
    account_no: string;
    ifsc: string;
  };
  settled_at?: string | null;
  settled_by?: string | null;
  created_at: string;
  shop?: Shop;
}

export interface B2BCreditLedger {
  id: string;
  b2b_account_id: string;
  type: 'credit_used' | 'payment_settled' | 'limit_increased';
  amount: number;
  balance_after: number;
  reference_order_id?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}
