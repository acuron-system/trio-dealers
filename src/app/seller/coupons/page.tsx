"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ArrowLeft, Tag, Megaphone } from "lucide-react";

export default function SellerCouponsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const shop = user?.shop;

  const [coupons, setCoupons] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrder, setMinOrder] = useState("1500");

  const loadData = useCallback(async () => {
    if (!shop || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const [{ data: cData }, { data: aData }] = await Promise.all([
      supabase.from("coupons").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
      supabase.from("ad_campaigns").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    ]);
    setCoupons(cData || []);
    setCampaigns(aData || []);
  }, [shop]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !code.trim()) return;
    const supabase = createClient();
    const validTo = new Date(Date.now() + 90 * 86400000).toISOString();
    const { data } = await supabase
      .from("coupons")
      .insert({
        code: code.trim().toUpperCase(),
        shop_id: shop.id,
        discount_type: "percentage",
        discount_value: Number(discountValue),
        min_order_value: Number(minOrder),
        max_discount: 1000,
        usage_limit: 200,
        valid_from: new Date().toISOString(),
        valid_to: validTo,
        is_active: true,
      })
      .select("*")
      .single();
    if (data) {
      setCoupons((prev) => [data, ...prev]);
      setCode("");
    }
  };

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <Link
            href="/shop-dashboard"
            className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Seller Dashboard
          </Link>
          <h1 className="text-2xl font-heading font-extrabold text-ink flex items-center gap-2">
            <Tag className="w-5 h-5 text-gold-400" /> Seller Promo Coupons &amp; Sponsored Slots
          </h1>
        </div>

        <form
          onSubmit={handleCreateCoupon}
          className="luxury-card rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end"
        >
          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Coupon Code</label>
            <input
              type="text"
              required
              placeholder="MILL10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono uppercase text-ink"
            />
          </div>
          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Discount (%)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
            />
          </div>
          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Min Order (INR)</label>
            <input
              type="number"
              min="0"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
            />
          </div>
          <button type="submit" className="btn-gold-luxury px-4 py-2.5 rounded-xl">
            Create Mill Coupon
          </button>
        </form>

        <div className="luxury-card rounded-2xl overflow-hidden text-xs">
          {coupons.length === 0 ? (
            <p className="p-6 text-ink-muted">No shop-specific coupons created yet.</p>
          ) : (
            <div className="divide-y divide-edge">
              {coupons.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-gold-400">{c.code}</p>
                    <p className="text-ink-muted">
                      {c.discount_value}% off • Min ₹{c.min_order_value} • Used {c.times_used}/{c.usage_limit}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold uppercase text-[10px]">
                    {c.is_active ? "Active" : "Paused"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-heading font-bold text-ink flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-gold-400" /> Sponsored Ad Campaigns
          </h2>
          <div className="luxury-card rounded-2xl p-5 text-xs text-ink-muted">
            {campaigns.length === 0
              ? "No active ad campaigns configured yet. Contact Trio Dealers Admin for featured banner placement."
              : `${campaigns.length} active ad campaigns tracked.`}
          </div>
        </section>
      </div>
    </div>
  );
}

