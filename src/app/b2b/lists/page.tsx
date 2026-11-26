"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrdersWithDetails, fetchPublicProducts } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/utils";
import type { Order, Product } from "@/types/database";
import {
  BookmarkPlus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  CalendarClock,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

interface SavedListRow {
  id: string;
  name: string;
  items: Array<{ product_id: string; variant_id: string; quantity: number }>;
  created_at: string;
}

interface RecurringOrderRow {
  id: string;
  title: string;
  frequency: "weekly" | "biweekly" | "monthly";
  items: Array<{ product_id: string; variant_id: string; quantity: number }>;
  next_run_at: string;
  is_active: boolean;
}

export default function B2BSavedListsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { items: cartItems, addBulkItems, setIsCartOpen } = useCart();

  const [lists, setLists] = useState<SavedListRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringOrderRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newListName, setNewListName] = useState("");
  const [scheduleFreq, setScheduleFreq] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [listsRes, recRes, orders, prods] = await Promise.all([
      supabase
        .from("saved_lists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("recurring_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      fetchOrdersWithDetails(supabase, user.id),
      fetchPublicProducts(supabase),
    ]);

    setLists((listsRes.data || []) as SavedListRow[]);
    setRecurring((recRes.data || []) as RecurringOrderRow[]);
    setRecentOrders(orders.slice(0, 6));
    setProducts(prods);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const showMsg = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveCurrentCart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cartItems.length === 0 || !newListName.trim()) return;
    const supabase = createClient();
    const payloadItems = cartItems.map((c) => ({
      product_id: c.product.id,
      variant_id: c.variant.id,
      quantity: c.quantity,
    }));

    const { data, error } = await supabase
      .from("saved_lists")
      .insert({
        user_id: user.id,
        name: newListName.trim(),
        items: payloadItems,
      })
      .select("*")
      .single();

    if (!error && data) {
      setLists((prev) => [data as SavedListRow, ...prev]);
      setNewListName("");
      showMsg("Saved current bag as a reusable B2B procurement list.");
    }
  };

  const handleLoadListToCart = (
    entries: Array<{ product_id: string; variant_id: string; quantity: number }>
  ) => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    let addedCount = 0;

    for (const entry of entries) {
      const prod = productMap.get(entry.product_id);
      const variant = prod?.variants?.find((v) => v.id === entry.variant_id);
      if (prod && variant) {
        addBulkItems(prod, [{ variant, quantity: entry.quantity }]);
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      setIsCartOpen(true);
      showMsg(`Added ${addedCount} bulk line items to your bag.`);
    } else {
      showMsg("Items in this list are currently unavailable or inactive.");
    }
  };

  const handleScheduleRecurring = async (list: SavedListRow) => {
    if (!user) return;
    const supabase = createClient();
    const days = scheduleFreq === "weekly" ? 7 : scheduleFreq === "biweekly" ? 14 : 30;
    const nextRun = new Date(Date.now() + days * 86400000).toISOString();

    const { data, error } = await supabase
      .from("recurring_orders")
      .insert({
        user_id: user.id,
        title: `${list.name} (${scheduleFreq})`,
        frequency: scheduleFreq,
        items: list.items,
        next_run_at: nextRun,
        is_active: true,
      })
      .select("*")
      .single();

    if (!error && data) {
      setRecurring((prev) => [data as RecurringOrderRow, ...prev]);
      showMsg(`Scheduled ${scheduleFreq} replenishment reminder for ${list.name}.`);
    }
  };

  const handleDeleteList = async (id: string) => {
    const supabase = createClient();
    await supabase.from("saved_lists").delete().eq("id", id);
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/b2b/dashboard"
              className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to B2B Trade Desk
            </Link>
            <h1 className="text-2xl font-heading font-extrabold text-ink">
              Saved Procurement Lists &amp; Recurring Reorders
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Bookmark frequent fabric assortments, reorder past B2B consignments in 1 click, or schedule repeat mill replenishment.
            </p>
          </div>
        </div>

        {toast && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Save current bag */}
        <form
          onSubmit={handleSaveCurrentCart}
          className="luxury-card rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
        >
          <input
            type="text"
            placeholder="Name current bag (e.g. Monthly Giza 60s White Restock)"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            required
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-xs text-ink outline-none focus:border-gold-500"
          />
          <button
            type="submit"
            disabled={cartItems.length === 0}
            className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <BookmarkPlus className="w-4 h-4" />
            Save Current Bag ({cartItems.length} items)
          </button>
        </form>

        {/* Saved Lists */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-heading font-bold text-ink">
              Your Saved Reorder Lists
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-muted">Schedule cadence:</span>
              <select
                value={scheduleFreq}
                onChange={(e) => setScheduleFreq(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-input border border-edge text-xs text-ink"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-ink-muted">Loading saved lists...</p>
          ) : lists.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No saved procurement lists yet. Add items to your bag and save them above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lists.map((list) => (
                <div key={list.id} className="luxury-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{list.name}</h3>
                      <p className="text-[11px] text-ink-muted">
                        {list.items?.length || 0} line items • Saved {formatDate(list.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="text-ink-muted hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLoadListToCart(list.items || [])}
                      className="btn-gold-luxury px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Add All to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScheduleRecurring(list)}
                      className="px-3.5 py-2 rounded-xl border border-edge hover:border-gold-500/50 text-xs font-semibold text-ink inline-flex items-center gap-1.5"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-gold-400" /> Automate ({scheduleFreq})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Recurring Schedules */}
        {recurring.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-heading font-bold text-ink">
              Scheduled Recurring Restocks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurring.map((r) => (
                <div key={r.id} className="luxury-card rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-ink">{r.title}</p>
                    <p className="text-ink-muted">
                      Next scheduled check: {formatDate(r.next_run_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoadListToCart(r.items || [])}
                    className="px-3 py-1.5 rounded-lg bg-gold-500/15 border border-gold-500/40 text-gold-400 font-bold"
                  >
                    Order Now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 1-Click Reorder Past Orders */}
        <section className="space-y-3">
          <h2 className="text-base font-heading font-bold text-ink flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gold-400" /> Quick Reorder Previous Consignments
          </h2>
          {recentOrders.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No past orders found to reorder yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((ord) => {
                const orderLines = (ord.sub_orders || []).flatMap((s) =>
                  (s.items || []).map((i) => ({
                    product_id: i.product_id || "",
                    variant_id: i.variant_id || "",
                    quantity: i.quantity,
                  }))
                );
                return (
                  <div
                    key={ord.id}
                    className="luxury-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <p className="font-mono font-bold text-gold-400">{ord.order_no}</p>
                      <p className="text-ink-muted">
                        Placed {formatDate(ord.created_at)} • {formatINR(ord.total_amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadListToCart(orderLines)}
                      className="px-4 py-2 rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400 font-bold hover:bg-gold-500 hover:text-black transition"
                    >
                      Reorder Consignment →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

