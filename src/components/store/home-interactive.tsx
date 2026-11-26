"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import type { Product } from "@/types/database";
import { Building2, Clock, ArrowRight, Sparkles } from "lucide-react";

export function LiveFlashCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-500/15 border border-gold-500/40 text-gold-400 text-[11px] font-mono font-bold">
      <Clock className="w-3 h-3" />
      {remaining || "Live"}
    </span>
  );
}

/**
 * Interactive B2B Wholesale Calculator driven strictly by a real DB product & price slabs.
 */
export function DynamicB2BMarginCalculator({
  product,
}: {
  product: Product;
}) {
  const slabs = [...(product.price_slabs || [])].sort((a, b) => a.min_qty - b.min_qty);
  const initialQty = Math.max(product.b2b_moq || 10, slabs[0]?.min_qty || 10);
  const [qty, setQty] = useState(initialQty);

  const matchedSlab = [...slabs]
    .sort((a, b) => b.min_qty - a.min_qty)
    .find((s) => qty >= s.min_qty);
  const unitRate = matchedSlab ? Number(matchedSlab.unit_price) : Number(product.retail_price);
  const orderValue = unitRate * qty;
  const retailEquivalent = Number(product.retail_price) * qty;
  const totalSavings = Math.max(0, retailEquivalent - orderValue);
  const gstCredit = Math.round((orderValue * Number(product.gst_rate || 5)) / 100);

  return (
    <div className="luxury-card-elevated rounded-3xl p-6 sm:p-8 border border-gold-500/35 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Live DB B2B Slab Estimator
          </span>
          <h3 className="text-lg font-heading font-bold text-ink mt-1">
            {product.name}
          </h3>
        </div>
        <Link
          href={`/product/${product.slug}`}
          className="text-xs font-bold text-gold-400 hover:underline inline-flex items-center gap-1"
        >
          Inspect Listing <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-secondary font-medium">
            Order Quantity ({qty} units)
          </span>
          <span className="font-mono font-bold text-gold-400">
            Active Rate: {formatINR(unitRate)} / unit
          </span>
        </div>
        <input
          type="range"
          min={initialQty}
          max={Math.max(initialQty * 10, 200)}
          step={5}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="w-full accent-gold-500 cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-surface border border-edge">
          <p className="text-ink-muted">Batch Net Subtotal</p>
          <p className="text-lg font-mono font-bold text-ink mt-0.5">
            {formatINR(orderValue)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-surface border border-edge">
          <p className="text-ink-muted">Bulk Slab Savings</p>
          <p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
            {formatINR(totalSavings)}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-surface border border-edge">
          <p className="text-ink-muted">GST Input Credit ({product.gst_rate}%)</p>
          <p className="text-lg font-mono font-bold text-gold-400 mt-0.5">
            {formatINR(gstCredit)}
          </p>
        </div>
      </div>

      {slabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slabs.map((slab) => (
            <button
              key={slab.id}
              type="button"
              onClick={() => setQty(slab.min_qty)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono border transition ${
                qty >= slab.min_qty
                  ? "border-gold-500 bg-gold-500/15 text-gold-400 font-bold"
                  : "border-edge text-ink-muted hover:text-ink"
              }`}
            >
              {slab.min_qty}+ pcs @ {formatINR(slab.unit_price)}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-edge text-[11px] text-ink-muted">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          HSN {product.hsn_code || "5007"} • Retail Rate: {formatINR(product.retail_price)}
        </span>
        <Link href="/b2b/register" className="text-gold-400 font-bold hover:underline">
          Apply for Verified B2B Account →
        </Link>
      </div>
    </div>
  );
}

