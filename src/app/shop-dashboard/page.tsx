"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchShopSubOrders,
  fetchPublicProducts,
  fetchShopPayoutData,
} from "@/lib/db";
import { formatINR, formatDate, getOrderStatusBadge } from "@/lib/utils";
import { Product, SubOrder, SubOrderStatus, Payout } from "@/types/database";
import {
  Store,
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Bell,
  Plus,
  CreditCard,
  ExternalLink,
} from "lucide-react";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function ShopDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const shop = user?.shop;

  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [updateToast, setUpdateToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!shop || !user || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [subs, prods, payData, notifRes] = await Promise.all([
        fetchShopSubOrders(supabase, shop.id),
        fetchPublicProducts(supabase, { shopId: shop.id, includeAllForAdmin: true }),
        fetchShopPayoutData(supabase, shop.id),
        supabase
          .from("notifications")
          .select("id, title, message, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      setSubOrders(subs);
      setProducts(prods);
      setPayouts(payData.payouts);
      if (!notifRes.error && notifRes.data) {
        setNotifications(notifRes.data as NotificationRow[]);
      }
      setLoading(false);
    }
    if (!authLoading) {
      load();
    }
  }, [shop, user, authLoading]);

  const totalSales = useMemo(
    () =>
      subOrders
        .filter((s) => s.status !== "cancelled" && s.status !== "returned")
        .reduce((acc, s) => acc + Number(s.total || 0), 0),
    [subOrders]
  );

  const totalEarnings = useMemo(
    () =>
      subOrders
        .filter((s) => s.status !== "cancelled" && s.status !== "returned")
        .reduce((acc, s) => acc + Number(s.shop_earnings || 0), 0),
    [subOrders]
  );

  const pendingOrders = useMemo(
    () =>
      subOrders.filter((s) =>
        ["placed", "accepted", "packed"].includes(s.status)
      ).length,
    [subOrders]
  );

  const settledPayoutsTotal = useMemo(
    () =>
      payouts
        .filter((p) => p.status === "settled")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0),
    [payouts]
  );

  const lowStockVariants = useMemo(() => {
    const rows: Array<{
      productName: string;
      color: string;
      stock_qty: number;
    }> = [];
    products.forEach((p) => {
      p.variants?.forEach((v) => {
        if ((v.stock_qty ?? 0) < 25) {
          rows.push({
            productName: p.name,
            color: v.color,
            stock_qty: v.stock_qty ?? 0,
          });
        }
      });
    });
    return rows;
  }, [products]);

  const handleUpdateStatus = async (subId: string, nextStatus: SubOrderStatus) => {
    const res = await fetch("/api/seller/sub-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subOrderId: subId,
        status: nextStatus === "accepted" || nextStatus === "packed" || nextStatus === "ready_for_pickup" ? nextStatus : "confirmed",
      }),
    });

    if (!res.ok) return;

    setSubOrders((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: nextStatus } : s))
    );
    setUpdateToast(
      `Sub-order updated to ${nextStatus.replace(/_/g, " ").toUpperCase()}`
    );
    setTimeout(() => setUpdateToast(null), 3500);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading mill seller workspace...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-4">
        <Store className="w-12 h-12 text-gold-400 mx-auto" />
        <h1 className="text-2xl font-heading font-black text-ink">
          Seller Storefront Required
        </h1>
        <p className="text-xs text-ink-secondary">
          Register your textile mill or wholesale boutique to list products and fulfill direct orders.
        </p>
        <Link
          href="/seller/register"
          className="inline-block px-6 py-3 btn-gold-luxury text-xs rounded-xl"
        >
          Apply as Seller Partner
        </Link>
      </div>
    );
  }

  if (shop.kyc_status !== "approved") {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-amber-500/12 border-2 border-amber-500/40 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <Clock className="w-10 h-10 animate-pulse" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            KYC Status: {shop.kyc_status.toUpperCase()}
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Seller Onboarding Verification
          </h1>
          <p className="text-ink-secondary text-sm max-w-md mx-auto">
            {shop.kyc_status === "pending"
              ? `Your mill profile for "${shop.shop_name}" is currently under KYC review by Trio Dealers admin.`
              : `Your seller storefront status is currently "${shop.kyc_status}". Contact support for assistance.`}
          </p>
        </div>
        <div className="luxury-card rounded-2xl p-4 max-w-md mx-auto text-left text-xs text-ink-secondary space-y-1">
          <p>
            • Shop Name: <strong className="text-ink">{shop.shop_name}</strong>
          </p>
          <p>• GSTIN: {shop.gstin || "Pending"}</p>
          <p>• Location: {shop.city}, {shop.state}</p>
        </div>
      </div>
    );
  }

  const filteredSubOrders =
    filterStatus === "all"
      ? subOrders
      : subOrders.filter((s) => s.status === filterStatus);

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Header */}
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
              Verified Mill Seller Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              {shop.shop_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
              <span>
                GSTIN:{" "}
                <strong className="text-ink font-mono">
                  {shop.gstin || "Verified"}
                </strong>
              </span>
              <span>•</span>
              <span>
                {shop.city}, {shop.state}
              </span>
              <span>•</span>
              <span className="text-gold-400 font-semibold">
                {shop.commission_rate}% Platform Commission
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/seller/products"
              className="px-4 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Manage Products
            </Link>
            <Link
              href="/seller/payouts"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-gold-400" />
              Payouts Ledger
            </Link>
            <Link
              href="/seller/returns"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-1.5"
            >
              Returns
            </Link>
            <Link
              href="/seller/engagement"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-1.5"
            >
              Q&amp;A &amp; Chat
            </Link>
            <Link
              href="/seller/coupons"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-1.5"
            >
              Coupons
            </Link>
            <Link
              href={`/shop/${shop.slug}`}
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink-secondary hover:text-ink text-xs font-semibold transition flex items-center gap-1.5"
            >
              Storefront
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {updateToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{updateToast}</span>
          </div>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="p-5 rounded-3xl luxury-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Bell className="w-4 h-4 text-gold-400" />
                Recent Moderation & Dispatch Alerts
              </h2>
              <Link
                href="/seller/products"
                className="text-[11px] text-gold-400 hover:underline font-semibold"
              >
                Manage Products →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl bg-surface-subtle border border-edge text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-ink">{n.title}</strong>
                    <span className="text-[10px] text-ink-muted font-mono">
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-secondary">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Gross Sales</span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink">
              {formatINR(totalSales)}
            </p>
            <p className="text-[10px] text-ink-muted">
              Across retail & B2B orders
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card border border-gold-500/35 space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span className="text-gold-400 font-semibold">Net Earnings</span>
              <CheckCircle2 className="w-4 h-4 text-gold-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-gold-400">
              {formatINR(totalEarnings)}
            </p>
            <p className="text-[10px] text-ink-muted">
              Post platform commission ({shop.commission_rate}%)
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Pending Dispatch</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink">
              {pendingOrders}
            </p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Requires packing & pickup
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Pending Payout</span>
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink">
              {formatINR(Math.max(0, totalEarnings - settledPayoutsTotal))}
            </p>
            <Link
              href="/seller/payouts"
              className="text-[10px] text-gold-400 hover:underline font-semibold"
            >
              View Payout Ledger →
            </Link>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {lowStockVariants.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Low Stock Warning: {lowStockVariants.length} Variants Below
                  Threshold (25 units)
                </p>
                <p className="text-[11px] text-ink-secondary">
                  {lowStockVariants
                    .map(
                      (v) => `${v.productName} (${v.color}: ${v.stock_qty} pcs)`
                    )
                    .join(" • ")}
                </p>
              </div>
            </div>
            <Link
              href="/seller/products"
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold whitespace-nowrap transition"
            >
              Update Inventory
            </Link>
          </div>
        )}

        {/* Sub-Orders Fulfillment Queue */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <Package className="w-5 h-5 text-gold-400" /> Sub-Orders Fulfillment Queue
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-muted">Filter:</span>
              {[
                "all",
                "placed",
                "accepted",
                "packed",
                "ready_for_pickup",
                "in_transit",
                "delivered",
              ].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg capitalize transition ${
                    filterStatus === st
                      ? "bg-gold-500 text-black font-bold"
                      : "bg-surface border border-edge text-ink-secondary hover:text-ink"
                  }`}
                >
                  {st.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {filteredSubOrders.length === 0 ? (
            <div className="p-12 rounded-3xl luxury-card text-center text-xs text-ink-muted">
              No fulfillment orders in this status queue yet.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubOrders.map((sub) => (
                <div
                  key={sub.id}
                  className="p-6 rounded-3xl luxury-card hover:border-gold-500/40 transition space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-gold-400">
                          {sub.sub_order_no}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getOrderStatusBadge(
                            sub.status
                          )}`}
                        >
                          {sub.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary">
                        Ordered: {formatDate(sub.created_at)} • Ship to:{" "}
                        {sub.parent_order?.address_snapshot?.city || "India"},{" "}
                        {sub.parent_order?.address_snapshot?.state || ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-ink-secondary">
                        Your Net Credit:{" "}
                        <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                          {formatINR(sub.shop_earnings || 0)}
                        </strong>
                      </p>
                      <p className="text-sm font-bold font-mono text-ink">
                        Total: {formatINR(sub.total)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sub.items?.map((it) => (
                      <div
                        key={it.id}
                        className="p-3 rounded-xl bg-surface-subtle flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-ink">
                            {it.product_name}
                          </p>
                          <p className="text-[11px] text-ink-secondary">
                            {it.variant_info} • HSN: {it.hsn_code}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-ink">
                          {it.quantity} x {formatINR(it.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <Link
                      href={`/seller/orders/${sub.id}/slip`}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-subtle border border-edge hover:border-gold-500 text-xs font-semibold text-ink transition"
                    >
                      Packing &amp; GST Slip
                    </Link>

                    {sub.status === "placed" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(sub.id, "accepted")}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                      >
                        Accept Consignment
                      </button>
                    )}

                    {sub.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(sub.id, "packed")}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                      >
                        Mark as Packed
                      </button>
                    )}

                    {sub.status === "packed" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateStatus(sub.id, "ready_for_pickup")
                        }
                        className="px-4 py-1.5 rounded-lg btn-gold-luxury text-xs flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Mark Ready for Transporter Pickup
                      </button>
                    )}

                    {sub.status === "ready_for_pickup" && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/25">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        Awaiting Transporter OTP Pickup
                      </span>
                    )}

                    {sub.status === "in_transit" && (
                      <span className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/25">
                        <Truck className="w-3.5 h-3.5" />
                        In Transit with Courier
                      </span>
                    )}

                    {sub.status === "delivered" && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/25">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Consignment Delivered
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
