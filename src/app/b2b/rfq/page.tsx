"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchPublicProducts, fetchRfqRequests } from "@/lib/db";
import { formatINR, formatDate } from "@/lib/utils";
import { Product, RfqRequest } from "@/types/database";
import {
  FileText,
  Clock,
  CheckCircle2,
  ShoppingBag,
  Send,
  Store,
  Calendar,
  Sparkles,
} from "lucide-react";

export default function B2BRfqPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { addItem, setIsCartOpen } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [rfqs, setRfqs] = useState<RfqRequest[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(250);
  const [targetPrice, setTargetPrice] = useState(2100);
  const [notes, setNotes] = useState("");
  const [submittedToast, setSubmittedToast] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [prods, rfqRows] = await Promise.all([
        fetchPublicProducts(supabase),
        user?.b2b_account
          ? fetchRfqRequests(supabase, user.b2b_account.id)
          : Promise.resolve([]),
      ]);
      setProducts(prods);
      if (prods.length > 0) setSelectedProductId(prods[0].id);
      setRfqs(rfqRows);
      setLoading(false);
    }
    if (!authLoading) {
      load();
    }
  }, [user, authLoading]);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0];

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.b2b_account || !selectedProduct) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("rfq_requests")
      .insert({
        b2b_account_id: user.b2b_account.id,
        product_id: selectedProduct.id,
        shop_id: selectedProduct.shop_id,
        quantity,
        target_price: targetPrice,
        notes: notes || "Bulk consignment requirement.",
        status: "requested",
      })
      .select("*")
      .single();

    if (error || !data) return;

    const newRfq: RfqRequest = {
      ...(data as RfqRequest),
      product: selectedProduct,
      shop: selectedProduct.shop,
      quotes: [],
    };

    setRfqs([newRfq, ...rfqs]);
    setSubmittedToast(true);
    setNotes("");
    setTimeout(() => setSubmittedToast(false), 4000);
  };

  const handleAcceptQuote = async (rfq: RfqRequest) => {
    if (!rfq.quotes || rfq.quotes.length === 0 || !rfq.product) return;
    const activeQuote = rfq.quotes[0];

    const quotedProduct = {
      ...rfq.product,
      retail_price: activeQuote.quoted_price,
      price_slabs: [
        {
          id: "custom",
          product_id: rfq.product.id,
          min_qty: 1,
          unit_price: activeQuote.quoted_price,
        },
      ],
    };

    const variant = rfq.product.variants?.[0] || {
      id: "v-custom",
      product_id: rfq.product.id,
      size: "Custom Consignment",
      color: "Custom",
      sku: `RFQ-${rfq.id}`,
      stock_qty: activeQuote.min_qty,
    };

    addItem(quotedProduct, variant, activeQuote.min_qty);

    const supabase = createClient();
    await supabase
      .from("rfq_requests")
      .update({ status: "accepted" })
      .eq("id", rfq.id);

    setRfqs(
      rfqs.map((item) =>
        item.id === rfq.id ? { ...item, status: "accepted" as const } : item
      )
    );

    setIsCartOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading RFQ quotation desk...
      </div>
    );
  }

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header */}
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-gold-400" />
              Custom Price Negotiation
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              Request for Quotation (RFQ)
            </h1>
            <p className="text-xs text-ink-secondary max-w-lg">
              Negotiate directly with Surat mills for orders above standard price slabs (100+ sarees, 500+ meters, or bespoke weave patterns).
            </p>
          </div>

          <Link
            href="/b2b/dashboard"
            className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink-secondary hover:text-ink text-xs font-bold transition self-start md:self-auto"
          >
            ← Back to Trade Desk
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Request Form */}
          <div className="lg:col-span-1 p-6 rounded-3xl luxury-card border border-gold-500/35 space-y-5 h-fit">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Send className="w-4 h-4 text-gold-400" /> New Quotation Request
              </h2>
              <p className="text-xs text-ink-secondary">
                Submit your required volume and desired price target.
              </p>
            </div>

            {submittedToast && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Quotation sent to mill sales desk! Response within 4 hours.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateRfq} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1.5">
                  Target Fabric / Saree Design
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.shop?.shop_name || "Trio Mill"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1.5">
                  Quantity (Pieces or Meters)
                </label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(parseInt(e.target.value, 10) || 50)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono focus:border-gold-500 outline-none"
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  Recommended for 50+ pcs to receive factory margin.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1.5">
                  Target Unit Price (₹ / piece)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-ink-muted">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="100"
                    required
                    value={targetPrice}
                    onChange={(e) =>
                      setTargetPrice(parseInt(e.target.value, 10) || 100)
                    }
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono focus:border-gold-500 outline-none"
                  />
                </div>
                <p className="text-[10px] text-ink-muted mt-1">
                  {selectedProduct
                    ? `Retail reference: ${formatINR(selectedProduct.retail_price)}`
                    : "Select a catalog item"}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1.5">
                  Consignment Remarks / Customisation
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify delivery timeline, custom embroidery, or specific color splits..."
                  className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit RFQ to Mill
              </button>
            </form>
          </div>

          {/* Right: Existing RFQs & Quotes */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-400" /> Active Requests & Quotes Received
              </h2>
              <span className="text-xs text-ink-secondary">
                {rfqs.length} requests
              </span>
            </div>

            {rfqs.map((rfq) => (
              <div
                key={rfq.id}
                className="p-6 rounded-3xl luxury-card hover:border-gold-500/35 transition space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-ink text-sm">
                        {rfq.product?.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rfq.status === "quoted"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            : rfq.status === "accepted"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-surface-subtle text-ink-secondary border border-edge"
                        }`}
                      >
                        {rfq.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                      <span className="flex items-center gap-1 text-gold-400">
                        <Store className="w-3.5 h-3.5" />{" "}
                        {rfq.shop?.shop_name || "Seller Mill"}
                      </span>
                      <span>•</span>
                      <span>Requested: {rfq.quantity} units</span>
                      <span>•</span>
                      <span>Target: {formatINR(rfq.target_price || 0)}</span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-ink-muted">
                    {formatDate(rfq.created_at)}
                  </div>
                </div>

                {rfq.notes && (
                  <div className="p-3 rounded-xl bg-surface-subtle text-xs text-ink-secondary italic">
                    &ldquo;{rfq.notes}&rdquo;
                  </div>
                )}

                {rfq.quotes && rfq.quotes.length > 0 ? (
                  <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gold-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Official Mill Quote Received
                      </span>
                      <span className="text-[11px] text-ink-secondary flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Valid until:{" "}
                        {formatDate(rfq.quotes[0].valid_until)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-ink">
                            {formatINR(rfq.quotes[0].quoted_price)}
                          </span>
                          <span className="text-xs text-ink-secondary">
                            / piece (Min {rfq.quotes[0].min_qty} pcs)
                          </span>
                        </div>
                        <p className="text-xs text-ink-secondary">
                          {rfq.quotes[0].remarks}
                        </p>
                      </div>

                      {rfq.status === "quoted" ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptQuote(rfq)}
                          className="px-5 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Accept Quote & Add to Bag
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/35 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Converted to Order
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-surface-subtle border border-edge text-xs text-ink-secondary flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                    <span>
                      Awaiting quotation response from the mill production team.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
