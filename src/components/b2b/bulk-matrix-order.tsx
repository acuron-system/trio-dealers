"use client";

import React, { useMemo, useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";
import type { Product, ProductVariant } from "@/types/database";
import { Grid3X3, ShoppingBag } from "lucide-react";

export function BulkMatrixOrder({ products }: { products: Product[] }) {
  const { addBulkItems, setIsCartOpen } = useCart();

  const b2bProducts = useMemo(
    () => products.filter((p) => p.sell_b2b && (p.variants?.length || 0) > 0),
    [products]
  );

  const [selectedId, setSelectedId] = useState(b2bProducts[0]?.id || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [gstInclusive, setGstInclusive] = useState(false);

  const product = useMemo(
    () => b2bProducts.find((p) => p.id === selectedId) || b2bProducts[0] || null,
    [b2bProducts, selectedId]
  );

  if (!product) {
    return (
      <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
        No B2B-enabled fabrics with active variants available for matrix ordering right now.
      </div>
    );
  }

  const variants = (product.variants || []).filter((v) => v.is_active !== false);
  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  const colors = Array.from(new Set(variants.map((v) => v.color)));

  const totalSelectedQty = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
  const slabs = [...(product.price_slabs || [])].sort((a, b) => b.min_qty - a.min_qty);
  const matchedSlab = slabs.find((s) => totalSelectedQty >= s.min_qty);
  const baseUnitRate = matchedSlab ? Number(matchedSlab.unit_price) : Number(product.retail_price);
  const gstMultiplier = gstInclusive ? 1 + Number(product.gst_rate || 5) / 100 : 1;
  const shownRate = baseUnitRate * gstMultiplier;

  const findVariant = (color: string, size: string): ProductVariant | undefined =>
    variants.find((v) => v.color === color && v.size === size);

  const handleAddMatrix = () => {
    const batch: Array<{ variant: ProductVariant; quantity: number }> = [];
    for (const v of variants) {
      const q = quantities[v.id] || 0;
      if (q > 0) batch.push({ variant: v, quantity: q });
    }
    if (batch.length === 0) return;
    addBulkItems(product, batch);
    setQuantities({});
    setIsCartOpen(true);
  };

  return (
    <div className="luxury-card rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-heading font-bold text-ink flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-gold-400" /> Size × Color Wholesale Matrix
          </h3>
          <p className="text-xs text-ink-muted">
            Enter quantities across all colors &amp; sizes in a single matrix; volume slabs recalculate automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setGstInclusive(!gstInclusive)}
            className="px-3 py-1.5 rounded-xl border border-edge bg-surface-subtle text-[11px] font-bold text-gold-400"
          >
            Prices: {gstInclusive ? `GST Inclusive (+${product.gst_rate}%)` : "Excl. GST"}
          </button>

          <select
            value={product.id}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setQuantities({});
            }}
            className="px-3 py-1.5 rounded-xl bg-surface-input border border-edge text-xs text-ink max-w-xs"
          >
            {b2bProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-edge rounded-2xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-subtle border-b border-edge">
            <tr>
              <th className="p-3 font-bold uppercase text-ink-muted">Color \ Size</th>
              {sizes.map((sz) => (
                <th key={sz} className="p-3 font-bold text-ink">
                  {sz}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {colors.map((clr) => (
              <tr key={clr}>
                <td className="p-3 font-semibold text-ink">{clr}</td>
                {sizes.map((sz) => {
                  const v = findVariant(clr, sz);
                  if (!v) {
                    return (
                      <td key={sz} className="p-3 text-ink-muted">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={v.id} className="p-3 space-y-1">
                      <input
                        type="number"
                        min={0}
                        max={v.stock_qty}
                        value={quantities[v.id] || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [v.id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                      />
                      <p className="text-[10px] text-ink-muted">Avail: {v.stock_qty}</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-edge">
        <div className="text-xs space-y-0.5">
          <p className="text-ink-secondary">
            Total Matrix Units:{" "}
            <strong className="font-mono text-ink">{totalSelectedQty} pcs</strong> • Active Rate:{" "}
            <strong className="font-mono text-gold-400">{formatINR(shownRate)} / pc</strong>
          </p>
          <p className="text-[11px] text-ink-muted">
            Batch Estimate: {formatINR(shownRate * totalSelectedQty)}
          </p>
        </div>

        <button
          type="button"
          disabled={totalSelectedQty <= 0}
          onClick={handleAddMatrix}
          className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
        >
          <ShoppingBag className="w-4 h-4" />
          Add Matrix Lot to Bag
        </button>
      </div>
    </div>
  );
}

