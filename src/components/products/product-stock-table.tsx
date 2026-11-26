"use client";

import React, { useState } from "react";
import { Product, StockMovement } from "@/types/database";
import { formatDateTime } from "@/lib/utils";
import { Package, RefreshCw } from "lucide-react";

interface ProductStockTableProps {
  movements: StockMovement[];
  products?: Product[];
  loading?: boolean;
  onStockAdjusted?: () => Promise<void> | void;
}

export function ProductStockTable({
  movements,
  products = [],
  loading = false,
  onStockAdjusted,
}: ProductStockTableProps) {
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [nextQty, setNextQty] = useState<number>(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allVariants = products.flatMap((p) =>
    (p.variants || []).map((v) => ({
      ...v,
      productName: p.name,
      shopName: p.shop?.shop_name || "House Stock",
    }))
  );

  const handleSaveAdjustment = async (variantId: string) => {
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/products/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: variantId,
          stock_qty: nextQty,
          reason: "manual_adjust",
          note: note.trim() || "Manual inventory update",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update stock.");
      }
      setEditingVariantId(null);
      setNote("");
      if (onStockAdjusted) await onStockAdjusted();
    } catch (err: any) {
      setErrorMsg(err.message || "Error updating stock.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-3xl luxury-card text-center text-xs text-ink-muted">
        Loading inventory movements...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Quick Variant Stock Controls */}
      {allVariants.length > 0 && (
        <div className="luxury-card rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-edge flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <Package className="w-4 h-4 text-gold-400" />
              Live SKU Variant Stock ({allVariants.length})
            </h3>
            <span className="text-[11px] text-ink-muted">
              Instant quantity updates (no approval wait)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-edge text-ink-secondary uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">SKU / Variant</th>
                  <th className="py-3 px-4 font-semibold">Current Stock</th>
                  <th className="py-3 px-4 font-semibold text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-ink-secondary">
                {allVariants.slice(0, 40).map((v) => (
                  <tr key={v.id} className="hover:bg-surface-subtle/40 transition">
                    <td className="py-3 px-4 font-semibold text-ink">
                      {v.productName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-ink">{v.size} • {v.color}</span>
                      {v.sku && (
                        <span className="block font-mono text-[10px] text-ink-muted">
                          {v.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          v.stock_qty <= (v.low_stock_threshold ?? 10)
                            ? "bg-red-500/12 text-red-600 dark:text-red-400"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {v.stock_qty} units
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingVariantId === v.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <input
                            type="number"
                            min={0}
                            value={nextQty}
                            onChange={(e) =>
                              setNextQty(parseInt(e.target.value, 10) || 0)
                            }
                            className="w-20 px-2.5 py-1 rounded-lg bg-surface-input border border-edge text-ink font-mono text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Note (optional)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-36 px-2.5 py-1 rounded-lg bg-surface-input border border-edge text-ink text-xs"
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveAdjustment(v.id)}
                            className="px-3 py-1 rounded-lg btn-gold-luxury text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingVariantId(null)}
                            className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-edge text-ink-secondary text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVariantId(v.id);
                            setNextQty(v.stock_qty);
                            setNote("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-edge hover:border-gold-500 text-ink font-semibold text-xs transition"
                        >
                          Edit Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Movement Log */}
      <div className="luxury-card rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-edge flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gold-400" />
            Stock Movement Ledger ({movements.length})
          </h3>
        </div>

        {movements.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No stock movements recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-edge text-ink-secondary uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Product & Variant</th>
                  <th className="py-3 px-4 font-semibold">Change</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Note</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-ink-secondary">
                {movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-surface-subtle/50 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                      {formatDateTime(mov.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-ink">
                        {mov.variant?.product?.name || "Variant"}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {mov.variant?.size} • {mov.variant?.color}{" "}
                        {mov.variant?.sku ? `(${mov.variant.sku})` : ""}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          mov.change_qty >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {mov.change_qty >= 0
                          ? `+${mov.change_qty}`
                          : mov.change_qty}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-subtle border border-edge text-[10px] uppercase font-semibold">
                        {mov.reason.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">{mov.note || "—"}</td>
                    <td className="py-3 px-4 text-ink">
                      {mov.actor?.full_name || "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
