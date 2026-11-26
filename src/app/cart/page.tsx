"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, subtotal, shipping, total } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="bg-canvas min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full luxury-card rounded-3xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/12 border border-gold-500/35 text-gold-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-heading font-bold text-ink">
              Your Shopping Bag is Empty
            </h1>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Explore artisanal Kanjivaram silk sarees, Egyptian Giza cotton, and mill-direct wholesale lots.
            </p>
          </div>
          <Link
            href="/catalog"
            className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
          >
            Browse Textile Catalog
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/catalog"
              className="text-xs text-ink-secondary hover:text-gold-400 inline-flex items-center gap-1.5 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Continue Shopping
            </Link>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink">
              Shopping Bag ({items.length})
            </h1>
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="px-4 py-2 rounded-xl border border-edge bg-surface hover:border-red-500/40 text-xs font-semibold text-ink-secondary hover:text-red-600 dark:hover:text-red-400 transition"
          >
            Clear All Items
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Items Column */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-3xl luxury-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden bg-surface-subtle border border-edge shrink-0">
                    <Image
                      src={
                        item.product.images?.[0]?.url ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80"
                      }
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-gold-400 tracking-wider">
                      {item.product.fabric || "Textile Piece"}
                    </span>
                    <Link href={`/product/${item.product.slug}`}>
                      <h3 className="text-sm font-semibold text-ink hover:text-gold-400 transition leading-snug">
                        {item.product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-ink-secondary">
                      {item.variant.size} • {item.variant.color}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm font-bold text-gold-400 font-mono">
                        {formatINR(item.unitPrice)}
                      </span>
                      {item.isWholesale && (
                        <span className="text-[9px] bg-gold-500/15 text-gold-400 px-2 py-0.5 rounded border border-gold-500/35 font-bold uppercase">
                          Wholesale Rate
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-edge">
                  <div className="flex items-center border border-edge rounded-xl bg-surface-input">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-1.5 text-ink-secondary hover:text-ink font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-ink font-mono">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1.5 text-ink-secondary hover:text-ink font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-ink font-mono">
                      {formatINR(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-ink-muted hover:text-red-600 dark:hover:text-red-400 transition p-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary Box */}
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="p-6 rounded-3xl luxury-card-elevated border border-gold-500/35 space-y-5">
              <h2 className="font-heading font-bold text-base text-ink pb-3 border-b border-edge flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs text-gold-400 font-mono font-normal">
                  INR (₹)
                </span>
              </h2>

              <div className="space-y-2.5 text-xs text-ink-secondary">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-ink font-mono font-medium">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Freight</span>
                  <span className="font-mono">
                    {shipping === 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        FREE
                      </span>
                    ) : (
                      formatINR(shipping)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST / Taxes</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    Included
                  </span>
                </div>

                <div className="pt-3 border-t border-edge flex justify-between text-base font-bold text-ink">
                  <span>Total Payable</span>
                  <span className="text-gold-400 font-mono text-xl">
                    {formatINR(total)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="w-full py-4 px-6 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="pt-2 flex items-center justify-center gap-2 text-xs text-ink-secondary">
                <ShieldCheck className="w-4 h-4 text-gold-400" />
                <span>Safe & Secure Checkout (COD / UPI Transfer)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
