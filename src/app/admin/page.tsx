"use client";

import React, { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrdersWithDetails, fetchPublicProducts } from "@/lib/db";
import { Order, Product, Shop } from "@/types/database";
import { formatINR } from "@/lib/utils";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  AlertTriangle,
  TrendingUp,
  Store,
} from "lucide-react";

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    async function loadOverview() {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      const [ords, prods, shopsRes] = await Promise.all([
        fetchOrdersWithDetails(supabase),
        fetchPublicProducts(supabase, { includeAllForAdmin: true }),
        supabase.from("shops").select("*"),
      ]);
      setOrders(ords);
      setProducts(prods);
      setShops((shopsRes.data as Shop[]) || []);
    }
    loadOverview();
  }, []);

  const totalSales = useMemo(() => {
    return orders.reduce(
      (acc, curr) => acc + Number(curr.total_amount || curr.total || 0),
      0
    );
  }, [orders]);

  const ordersToday = useMemo(() => {
    const todayPrefix = new Date().toISOString().split("T")[0];
    return orders.filter((o) => o.created_at.startsWith(todayPrefix)).length;
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter((o) =>
      ["placed", "confirmed", "processing", "Placed", "Confirmed", "Packed"].includes(
        o.status
      )
    ).length;
  }, [orders]);

  const lowStockVariants = useMemo(() => {
    const list: {
      productName: string;
      variantName: string;
      stock: number;
      sku: string;
    }[] = [];
    products.forEach((p) => {
      p.variants?.forEach((v) => {
        if (v.stock_qty <= 15) {
          list.push({
            productName: p.name,
            variantName: `${v.size} - ${v.color}`,
            stock: v.stock_qty,
            sku: v.sku || "N/A",
          });
        }
      });
    });
    return list;
  }, [products]);

  const pendingShopRegistrations = shops.filter(
    (s) => s.kyc_status === "pending"
  );

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
              Admin Executive Overview
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              Live status of orders, factory inventory, transporter logistics, and B2B accounts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/products"
              className="px-4 py-2 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider"
            >
              + Add Product
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl luxury-card border border-gold-500/35 space-y-2">
            <div className="flex items-center justify-between text-ink-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Sales
              </span>
              <div className="p-2 rounded-lg bg-gold-500/12 text-gold-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-heading font-black text-ink">
              {formatINR(totalSales)}
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Live consolidated order volume
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Orders Today
              </span>
              <div className="p-2 rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-heading font-black text-ink">
              {ordersToday}
            </div>
            <p className="text-[11px] text-ink-secondary">
              Retail & wholesale batches
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Pending Packing
              </span>
              <div className="p-2 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-heading font-black text-amber-700 dark:text-amber-400">
              {pendingOrders}
            </div>
            <p className="text-[11px] text-ink-secondary">
              Needs packing or transporter assignment
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Low Stock SKUs
              </span>
              <div className="p-2 rounded-lg bg-red-500/12 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-heading font-black text-red-600 dark:text-red-400">
              {lowStockVariants.length}
            </div>
            <p className="text-[11px] text-ink-secondary">
              &lt; 15 units remaining
            </p>
          </div>
        </div>

        {pendingShopRegistrations.length > 0 && (
          <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/40 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-gold-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-ink">
                  {pendingShopRegistrations.length} Wholesale Shop Registration(s) Awaiting Approval
                </h4>
                <p className="text-[11px] text-ink-secondary">
                  Review GST & business details to activate their seller storefront access.
                </p>
              </div>
            </div>
            <Link
              href="/admin/shops"
              className="px-4 py-2 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider shrink-0"
            >
              Review Shops →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 rounded-3xl luxury-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-gold-400" />
                Recent Orders
              </h3>
              <Link
                href="/admin/orders"
                className="text-xs text-gold-400 hover:underline font-semibold"
              >
                View All Orders →
              </Link>
            </div>

            <div className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-xs text-ink-muted py-6 text-center">
                  No customer orders recorded yet.
                </p>
              ) : (
                orders.slice(0, 6).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-surface-subtle border border-edge flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-ink">
                          {ord.order_no}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gold-400 bg-gold-500/12 px-1.5 py-0.5 rounded">
                          {ord.order_type}
                        </span>
                      </div>
                      <p className="text-ink-secondary text-[11px]">
                        {ord.address_snapshot.name}
                      </p>
                    </div>

                    <div className="text-right space-y-0.5">
                      <p className="font-bold text-ink">
                        {formatINR(ord.total_amount || ord.total || 0)}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-edge text-ink-secondary">
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                Low Stock Inventory Alerts
              </h3>
              <Link
                href="/admin/products"
                className="text-xs text-gold-400 hover:underline font-semibold"
              >
                Manage Stock →
              </Link>
            </div>

            <div className="space-y-3">
              {lowStockVariants.slice(0, 5).map((skuItem, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-surface-subtle border border-edge flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-ink line-clamp-1">
                      {skuItem.productName}
                    </p>
                    <p className="text-[11px] text-ink-muted font-mono">
                      {skuItem.variantName} ({skuItem.sku})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-bold font-mono">
                      {skuItem.stock} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
