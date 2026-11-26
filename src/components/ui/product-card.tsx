"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";
import { Heart, ShoppingBag, Eye, Check } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

function getColorCode(colorName: string): string {
  const c = colorName.toLowerCase();
  if (c.includes("red") || c.includes("crimson") || c.includes("maroon")) return "#8B0000";
  if (c.includes("green") || c.includes("emerald")) return "#0F5257";
  if (c.includes("blue") || c.includes("navy")) return "#0A2463";
  if (c.includes("gold") || c.includes("ochre") || c.includes("mustard")) return "#D4AF37";
  if (c.includes("purple") || c.includes("wine")) return "#581845";
  if (c.includes("white") || c.includes("pristine")) return "#F8F9FA";
  if (c.includes("pink") || c.includes("rose") || c.includes("peach")) return "#D98880";
  if (c.includes("black")) return "#1A1A1A";
  if (c.includes("grey") || c.includes("charcoal")) return "#3A3D40";
  return "#A08C5B";
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const { addItem, toggleWishlist, isInWishlist } = useCart();
  const isShopOrB2B = user?.role === "shop" || user?.role === "b2b";
  const inWishlist = isInWishlist(product.id);
  const [isAdded, setIsAdded] = useState(false);

  const primaryImage =
    product.images?.[0]?.url ||
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80";

  const defaultVariant = product.variants?.[0] || {
    id: "def-var",
    product_id: product.id,
    size: "Standard",
    color: "Default",
    sku: null,
    stock_qty: 10,
  };

  const lowestSlab =
    product.price_slabs && product.price_slabs.length > 0
      ? [...product.price_slabs].sort((a, b) => a.unit_price - b.unit_price)[0]
      : null;

  const minWholesaleQty =
    product.price_slabs && product.price_slabs.length > 0
      ? Math.min(...product.price_slabs.map((w) => w.min_qty))
      : product.b2b_moq || 10;

  const savingsPct = lowestSlab
    ? Math.round(((product.retail_price - lowestSlab.unit_price) / product.retail_price) * 100)
    : 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product, defaultVariant, 1);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="group relative rounded-2xl bg-surface border border-edge hover:border-gold-500/60 overflow-hidden transition-all duration-300 flex flex-col shadow-sm hover:shadow-card-hover">
      {/* Product Image Frame */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-elevated">
        <Image
          src={primaryImage}
          alt={product.name}
          fill
          className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none opacity-75 group-hover:opacity-60 transition duration-500" />

        {product.fabric && (
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-black/80 backdrop-blur-md text-gold-300 text-[9px] uppercase font-bold tracking-[0.12em] px-2.5 py-1 rounded-full border border-gold-500/35 shadow-sm">
              {product.fabric.split(" ")[0]} Weave
            </span>
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          aria-label="Save to Wishlist"
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/65 backdrop-blur-md text-white hover:text-gold-300 border border-white/15 transition duration-300 hover:scale-110"
        >
          <Heart className={`w-3.5 h-3.5 ${inWishlist ? "fill-gold-500 text-gold-500" : ""}`} />
        </button>

        {savingsPct > 0 && (
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none group-hover:opacity-0 transition-opacity">
            <span className="bg-gold-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">
              Save {savingsPct}% Bulk
            </span>
          </div>
        )}

        {/* Quick Add Overlay */}
        <div className="absolute inset-x-3 bottom-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex gap-2">
          <button
            onClick={handleQuickAdd}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow ${
              isAdded ? "bg-emerald-500 text-white" : "btn-gold-luxury"
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added!
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" /> Quick Add
              </>
            )}
          </button>

          <Link
            href={`/product/${product.slug}`}
            className="p-2.5 rounded-xl bg-black/80 hover:bg-black text-white border border-gold-500/40 flex items-center justify-center transition"
            title="Inspect Fabric Details"
          >
            <Eye className="w-3.5 h-3.5 text-gold-300" />
          </Link>
        </div>
      </div>

      {/* Product Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-semibold truncate">
              {product.category?.name || "Indian Textile"}
            </span>

            {product.variants && product.variants.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {product.variants.slice(0, 3).map((v) => (
                  <span
                    key={v.id}
                    title={v.color}
                    className="w-2.5 h-2.5 rounded-full border border-edge-strong shadow-sm"
                    style={{ backgroundColor: v.color_hex || getColorCode(v.color) }}
                  />
                ))}
                {product.variants.length > 3 && (
                  <span className="text-[9px] text-ink-muted font-mono">
                    +{product.variants.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          <Link href={`/product/${product.slug}`}>
            <h3 className="font-heading font-semibold text-ink text-sm group-hover:text-gold-400 transition-colors line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="pt-3 border-t border-edge flex items-end justify-between">
          <div>
            {isShopOrB2B && lowestSlab ? (
              <div>
                <span className="text-[9px] text-gold-400 uppercase tracking-wider font-bold block">
                  Wholesale MOQ {minWholesaleQty} pcs
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-gold-400 font-mono">
                    {formatINR(lowestSlab.unit_price)}
                  </span>
                  <span className="text-xs text-ink-muted line-through font-mono">
                    {formatINR(product.retail_price)}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[9px] text-ink-muted uppercase tracking-wider font-semibold block">
                  Retail Price
                </span>
                <span className="text-base font-bold text-ink font-mono">
                  {formatINR(product.retail_price)}
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/product/${product.slug}`}
            className="text-[11px] font-semibold text-gold-400 hover:underline transition flex items-center gap-1 group/btn"
          >
            Explore
            <span className="transition-transform group-hover/btn:translate-x-1">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
