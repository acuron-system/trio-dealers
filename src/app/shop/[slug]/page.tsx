"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchShopBySlug, fetchPublicProducts } from "@/lib/db";
import { Product, Shop } from "@/types/database";
import { ProductCard } from "@/components/ui/product-card";
import {
  ShieldCheck,
  Star,
  MapPin,
  FileText,
  Package,
} from "lucide-react";

export default function ShopStorefrontPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    async function loadStorefront() {
      if (!slug || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const loadedShop = await fetchShopBySlug(supabase, slug);
      setShop(loadedShop);
      if (loadedShop) {
        const shopProducts = await fetchPublicProducts(supabase, {
          shopId: loadedShop.id,
        });
        setProducts(shopProducts);
      }
      setLoading(false);
    }
    loadStorefront();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink-muted flex items-center justify-center text-xs">
        Loading storefront...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-2xl font-royal font-bold">Storefront Not Found</h1>
        <p className="text-xs text-ink-secondary">
          This seller storefront is pending KYC approval or unavailable.
        </p>
        <Link
          href="/catalog"
          className="px-5 py-2.5 btn-gold-luxury text-xs rounded-xl"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category?.name).filter(Boolean))
  );

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category?.name === activeCategory);

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16">
      {/* Hero Banner */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden border-b border-edge">
        <Image
          src={
            shop.banner_url ||
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80"
          }
          alt={shop.shop_name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
      </div>

      {/* Shop Info Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10 space-y-8">
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-gold-500 shadow-gold shrink-0 bg-black">
              <Image
                src={shop.logo_url || "/logo.png"}
                alt={shop.shop_name}
                fill
                className="object-cover"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
                  {shop.shop_name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gold-500/12 text-gold-400 border border-gold-500/35 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                  Verified Mill Partner
                </span>
              </div>

              <p className="text-xs text-ink-secondary flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 text-ink">
                  <MapPin className="w-3.5 h-3.5 text-gold-400" /> {shop.city},{" "}
                  {shop.state}
                </span>
                <span>•</span>
                <span>
                  GSTIN:{" "}
                  <strong className="text-ink font-mono">{shop.gstin}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-gold-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" /> {shop.rating} (
                  {shop.reviews_count} reviews)
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/b2b/rfq"
              className="px-5 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Request Custom Mill RFQ
            </Link>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeCategory === "all"
                ? "bg-gold-500 text-black shadow-gold"
                : "bg-surface text-ink-secondary hover:text-ink border border-edge"
            }`}
          >
            All Mill Products ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat || "all")}
              className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-gold-500 text-black shadow-gold"
                  : "bg-surface text-ink-secondary hover:text-ink border border-edge"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
              <Package className="w-5 h-5 text-gold-400" /> Active Product Catalog
            </h2>
            <span className="text-xs text-ink-muted">
              {filteredProducts.length} items available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>

        {/* Mill Trust & Guarantee */}
        <div className="p-8 rounded-3xl luxury-card grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-gold-500/12 text-gold-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-ink">
              Genuine Handloom / Mill Certified
            </h3>
            <p className="text-ink-secondary">
              100% authentic raw silk and Giza cotton guaranteed with Surat textile chamber provenance.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-gold-500/12 text-gold-400 flex items-center justify-center mx-auto">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-ink">Insured Dispatch Freight</h3>
            <p className="text-ink-secondary">
              Direct courier and transport partner dispatches with two-leg tracking and tamper-proof packing.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-gold-500/12 text-gold-400 flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-ink">Input Tax Credit (GST)</h3>
            <p className="text-ink-secondary">
              Official GST invoice issued per sub-order with eligible HSN code claiming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
