"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDate, formatINR } from "@/lib/utils";
import { Zap, Gift, Tag, CheckCircle2 } from "lucide-react";

export default function AdminMarketingPage() {
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [saleTitle, setSaleTitle] = useState("");
  const [saleProductId, setSaleProductId] = useState("");
  const [saleDiscount, setSaleDiscount] = useState("15");
  const [saleDays, setSaleDays] = useState("3");

  const [gcCode, setGcCode] = useState("");
  const [gcAmount, setGcAmount] = useState("2500");
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const [{ data: fs }, { data: gc }, { data: cp }, { data: pd }] = await Promise.all([
      supabase.from("flash_sales").select("*, product:products(name)").order("created_at", { ascending: false }),
      supabase.from("gift_cards").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("products").select("id, name").eq("approval_status", "approved").limit(50),
    ]);
    setFlashSales(fs || []);
    setGiftCards(gc || []);
    setCoupons(cp || []);
    setProducts(pd || []);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreateFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + Number(saleDays) * 86400000).toISOString();
    const { error } = await supabase.from("flash_sales").insert({
      title: saleTitle.trim(),
      product_id: saleProductId || null,
      discount_percent: Number(saleDiscount),
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    });
    if (!error) {
      setSaleTitle("");
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["deals", "homepage"] }),
      }).catch(() => null);
      showToast("Flash sale published.");
      await loadAll();
    }
  };

  const handleIssueGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gcCode.trim()) return;
    const supabase = createClient();
    const amt = Number(gcAmount);
    const { error } = await supabase.from("gift_cards").insert({
      code: gcCode.trim().toUpperCase(),
      initial_balance: amt,
      balance_remaining: amt,
      is_active: true,
    });
    if (!error) {
      setGcCode("");
      showToast("Digital Gift Card issued.");
      await loadAll();
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <Zap className="w-6 h-6 text-gold-500" />
            Promotions, Flash Sales, Coupons &amp; Gift Cards
          </h1>
        </div>

        {toast && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Flash Sale */}
          <form onSubmit={handleCreateFlashSale} className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm text-ink flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-400" /> Launch Timed Flash Sale
            </h2>
            <input
              type="text"
              required
              placeholder="Campaign Title"
              value={saleTitle}
              onChange={(e) => setSaleTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={saleProductId}
                onChange={(e) => setSaleProductId(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="">All Featured Items</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="70"
                value={saleDiscount}
                onChange={(e) => setSaleDiscount(e.target.value)}
                placeholder="%"
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-ink-muted flex items-center gap-2">
                Duration (Days):
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={saleDays}
                  onChange={(e) => setSaleDays(e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                />
              </label>
              <button type="submit" className="btn-gold-luxury px-4 py-2 rounded-xl">
                Publish Flash Sale
              </button>
            </div>
          </form>

          {/* Issue Gift Card */}
          <form onSubmit={handleIssueGiftCard} className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm text-ink flex items-center gap-2">
              <Gift className="w-4 h-4 text-gold-400" /> Issue Digital Gift Card
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="GIFT-TRIO-2500"
                value={gcCode}
                onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono uppercase text-ink"
              />
              <input
                type="number"
                min="100"
                required
                value={gcAmount}
                onChange={(e) => setGcAmount(e.target.value)}
                placeholder="Amount (INR)"
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
            </div>
            <button type="submit" className="btn-gold-luxury px-4 py-2 rounded-xl">
              Generate Gift Card
            </button>

            {giftCards.length > 0 && (
              <div className="pt-2 border-t border-edge space-y-1">
                {giftCards.slice(0, 4).map((g) => (
                  <div key={g.id} className="flex justify-between text-[11px]">
                    <span className="font-mono font-bold text-gold-400">{g.code}</span>
                    <span>
                      {formatINR(g.balance_remaining)} / {g.redeemed_by ? "Redeemed" : "Unclaimed"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Active Flash Sales & Coupons Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="luxury-card rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-ink">Active Flash Campaigns ({flashSales.length})</h3>
            {flashSales.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-surface border border-edge flex justify-between">
                <div>
                  <p className="font-bold text-ink">{s.title}</p>
                  <p className="text-ink-muted">Ends: {formatDate(s.ends_at)}</p>
                </div>
                <span className="font-mono font-bold text-gold-400">{s.discount_percent}% OFF</span>
              </div>
            ))}
          </div>

          <div className="luxury-card rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Tag className="w-4 h-4 text-gold-400" /> Platform Coupons ({coupons.length})
            </h3>
            {coupons.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-surface border border-edge flex justify-between">
                <span className="font-mono font-bold text-gold-400">{c.code}</span>
                <span className="text-ink-muted">
                  Used {c.times_used} / {c.usage_limit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

