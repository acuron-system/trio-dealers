"use client";

import React from "react";
import Link from "next/link";
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Truck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";

export function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    shipping,
    total,
    unavailableNotices,
    dismissUnavailableNotices,
  } = useCart();

  if (!isCartOpen) return null;

  const freeShippingThreshold = 1999;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const progressPct = Math.min(
    100,
    Math.round((subtotal / freeShippingThreshold) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-edge shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-edge flex items-center justify-between bg-surface-subtle/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/12 border border-gold-500/30 text-gold-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-ink text-base">
                  Your Order Bag ({items.length})
                </h2>
                <span className="text-[10px] text-ink-muted uppercase tracking-[0.16em] font-semibold">
                  Trio Dealers Atelier
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              aria-label="Close order bag"
              className="p-2 rounded-xl border border-edge text-ink-secondary hover:text-ink hover:bg-surface-subtle transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free Shipping Progress */}
          <div className="px-5 py-3 bg-surface-subtle/40 border-b border-edge space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-secondary font-medium">
                <Truck className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                {remainingForFreeShipping === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Free insured shipping unlocked!
                  </span>
                ) : (
                  <span>
                    Add{" "}
                    <strong className="text-ink font-semibold">
                      {formatINR(remainingForFreeShipping)}
                    </strong>{" "}
                    for free insured shipping
                  </span>
                )}
              </span>
              <span className="text-[11px] font-mono text-gold-400 font-semibold">
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-input overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Unavailable Product Notices */}
          {unavailableNotices.length > 0 && (
            <div className="mx-5 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No longer available</span>
                </div>
                <button
                  type="button"
                  onClick={dismissUnavailableNotices}
                  className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
                >
                  Dismiss
                </button>
              </div>
              <ul className="list-disc pl-5 text-amber-800/90 dark:text-amber-200/90 space-y-0.5 text-[11px]">
                {unavailableNotices.map((notice, idx) => (
                  <li key={idx}>{notice} removed from your bag.</li>
                ))}
              </ul>
            </div>
          )}

          {/* Body / Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center px-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-subtle border border-edge flex items-center justify-center text-gold-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-heading font-bold text-ink text-base">
                    Your order bag is empty
                  </p>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Discover artisanal Kanjivaram silks, crisp Egyptian Giza shirting,
                    and B2B textile packs curated from Surat & Banaras mills.
                  </p>
                </div>
                <Link
                  href="/catalog"
                  onClick={() => setIsCartOpen(false)}
                  className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
                >
                  Explore Fabric Catalog
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const thumb =
                    item.product.images?.[0]?.url || "/logo.png";
                  const maxStock =
                    typeof item.variant.stock_qty === "number" &&
                    item.variant.stock_qty > 0
                      ? item.variant.stock_qty
                      : 9999;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-edge hover:border-gold-500/35 transition flex gap-3.5"
                    >
                      <Link
                        href={`/product/${item.product.slug}`}
                        onClick={() => setIsCartOpen(false)}
                        className="w-20 h-24 rounded-xl overflow-hidden bg-surface-input border border-edge shrink-0 block"
                      >
                        <img
                          src={thumb}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </Link>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/product/${item.product.slug}`}
                              onClick={() => setIsCartOpen(false)}
                              className="text-xs font-heading font-bold text-ink hover:text-gold-400 transition line-clamp-2"
                            >
                              {item.product.name}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-ink-muted">
                                {item.variant.size} • {item.variant.color}
                              </span>
                              {item.isWholesale && (
                                <span className="px-1.5 py-0.5 rounded bg-gold-500/15 border border-gold-500/30 text-[9px] font-bold uppercase tracking-wider text-gold-400">
                                  B2B Rate
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.product.name}`}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2.5">
                          <div className="inline-flex items-center rounded-lg border border-edge bg-surface">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              aria-label="Decrease quantity"
                              className="p-1.5 text-ink-secondary hover:text-ink transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 text-xs font-mono font-bold text-ink">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  Math.min(maxStock, item.quantity + 1)
                                )
                              }
                              aria-label="Increase quantity"
                              className="p-1.5 text-ink-secondary hover:text-ink transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-bold text-ink">
                              {formatINR(item.unitPrice * item.quantity)}
                            </p>
                            <p className="text-[10px] text-ink-muted">
                              {formatINR(item.unitPrice)} / unit
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-edge bg-surface-subtle/60 space-y-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-ink-secondary">
                  <span>Subtotal</span>
                  <span className="font-semibold text-ink">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink-secondary">
                  <span>Shipping Freight</span>
                  {shipping === 0 ? (
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      FREE
                    </span>
                  ) : (
                    <span className="font-semibold text-ink">
                      {formatINR(shipping)}
                    </span>
                  )}
                </div>
                <div className="pt-2 border-t border-edge flex items-center justify-between text-sm">
                  <span className="font-heading font-bold text-ink">
                    Total Amount
                  </span>
                  <span className="font-heading font-bold text-gold-400 text-base">
                    {formatINR(total)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout ({formatINR(total)})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-ink-muted hover:text-red-600 dark:hover:text-red-400 font-medium transition"
                >
                  Clear Bag
                </button>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="text-gold-400 hover:underline font-semibold"
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
