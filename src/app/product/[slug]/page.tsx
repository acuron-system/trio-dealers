"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchProductBySlug } from "@/lib/db";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { Product, ProductVariant, Review } from "@/types/database";
import { ProductInteractiveAddons } from "@/components/store/product-interactive-addons";
import { formatDate, formatINR } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Heart,
  Layers,
  MessageCircle,
  PlayCircle,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const { user, role } = useAuth();
  const { addItem, toggleWishlist, isInWishlist, setIsCartOpen } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  // Review state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isB2BOrShop = role === "b2b" || role === "shop";

  useEffect(() => {
    async function load() {
      if (!slug || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const loaded = await fetchProductBySlug(supabase, slug);
      setProduct(loaded);
      if (loaded) {
        setReviews(loaded.reviews || []);
        const activeVariants = (loaded.variants || []).filter(
          (v) => v.is_active !== false
        );
        if (activeVariants.length > 0) {
          setSelectedColor(activeVariants[0].color);
          setSelectedSize(activeVariants[0].size);
        }
        if (role === "b2b" && loaded.b2b_moq && loaded.b2b_moq > 1 && loaded.sell_b2b) {
          setQuantity(loaded.b2b_moq);
        }
      }
      setLoading(false);
    }
    load();
  }, [slug, role]);

  const activeVariants = useMemo(() => {
    if (!product?.variants) return [];
    return product.variants.filter((v) => v.is_active !== false);
  }, [product]);

  const colors = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    activeVariants.forEach((v) => {
      if (!map.has(v.color)) map.set(v.color, v.color_hex);
    });
    return Array.from(map.entries()).map(([color, hex]) => ({ color, hex }));
  }, [activeVariants]);

  const sizesForColor = useMemo(() => {
    if (!selectedColor) return activeVariants;
    const filtered = activeVariants.filter((v) => v.color === selectedColor);
    return filtered.length > 0 ? filtered : activeVariants;
  }, [activeVariants, selectedColor]);

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    return (
      activeVariants.find(
        (v) => v.color === selectedColor && v.size === selectedSize
      ) ||
      activeVariants.find((v) => v.color === selectedColor) ||
      activeVariants[0]
    );
  }, [activeVariants, selectedColor, selectedSize]);

  const slabs = useMemo(() => {
    if (!product) return [];
    if (product.price_slabs && product.price_slabs.length > 0) {
      return [...product.price_slabs].sort((a, b) => a.min_qty - b.min_qty);
    }
    if (product.wholesale_prices && product.wholesale_prices.length > 0) {
      return [...product.wholesale_prices]
        .map((w) => ({
          id: w.id,
          product_id: w.product_id,
          min_qty: w.min_qty,
          unit_price: w.price,
        }))
        .sort((a, b) => a.min_qty - b.min_qty);
    }
    return [];
  }, [product]);

  const activeUnitPrice = useMemo(() => {
    if (!product) return 0;
    let price = product.retail_price;
    if ((isB2BOrShop || quantity > 1) && product.sell_b2b && slabs.length > 0) {
      const qualifying = slabs.filter((s) => quantity >= s.min_qty);
      if (qualifying.length > 0) {
        price = qualifying[qualifying.length - 1].unit_price;
      }
    }
    return price;
  }, [product, isB2BOrShop, quantity, slabs]);

  const lineTotal = activeUnitPrice * quantity;

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    addItem(product, selectedVariant, quantity);
    setAddedToast(true);
    setIsCartOpen(true);
    setTimeout(() => setAddedToast(false), 3500);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);

    if (!user) {
      setReviewError("Please sign in to submit a verified product review.");
      return;
    }
    if (!product) return;

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setReviewError(data.error || "Unable to submit review.");
      return;
    }

    if (data.review) {
      setReviews((prev) => [data.review as Review, ...prev]);
      setShowReviewModal(false);
      setReviewTitle("");
      setReviewComment("");
      setReviewRating(5);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-[4/5] rounded-3xl bg-surface-subtle" />
          <div className="space-y-4 py-4">
            <div className="h-4 w-1/4 bg-surface-subtle rounded" />
            <div className="h-9 w-3/4 bg-surface-subtle rounded" />
            <div className="h-24 w-full bg-surface-subtle rounded-2xl" />
            <div className="h-48 w-full bg-surface-subtle rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (
    !product ||
    product.deleted_at ||
    product.is_archived ||
    !product.is_active ||
    product.approval_status !== "approved"
  ) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold text-ink">
          Textile Product Not Available
        </h1>
        <p className="text-xs text-ink-secondary">
          This listing may have been unpublished or archived by the mill. Explore our active textile catalog instead.
        </p>
        <Link
          href="/catalog"
          className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Link>
      </div>
    );
  }

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [
          {
            id: "fallback",
            product_id: product.id,
            url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80",
            sort_order: 0,
          },
        ];

  const activeImg = gallery[selectedImageIdx] || gallery[0];
  const wishlistActive = isInWishlist(product.id);
  const mrpDiscountPct =
    product.mrp && product.mrp > activeUnitPrice
      ? Math.round(((product.mrp - activeUnitPrice) / product.mrp) * 100)
      : 0;

  return (
    <div className="bg-canvas py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <Link
              href="/catalog"
              className="hover:text-gold-400 transition inline-flex items-center gap-1.5 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Catalog
            </Link>
            {product.category && (
              <>
                <span>/</span>
                <Link
                  href={`/catalog?category=${product.category.slug}`}
                  className="hover:text-gold-400 transition"
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-ink font-semibold truncate max-w-[220px]">
              {product.name}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              wishlistActive
                ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400"
                : "bg-surface border-edge text-ink-secondary hover:text-ink"
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${wishlistActive ? "fill-current" : ""}`}
            />
            {wishlistActive ? "Saved to Wishlist" : "Save Item"}
          </button>
        </div>

        {/* Main Product 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-surface-subtle border border-edge shadow-luxury">
              <img
                src={activeImg.url}
                alt={activeImg.alt_text || product.name}
                className="w-full h-full object-cover"
              />
              {product.sell_b2b && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-gold-500/50 text-gold-300 text-[10px] font-bold uppercase tracking-wider">
                  B2B Wholesale Eligible
                </span>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {gallery.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition ${
                      selectedImageIdx === idx
                        ? "border-gold-500 shadow-gold"
                        : "border-edge opacity-75 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.alt_text || product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {product.video_url && (
              <a
                href={product.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl luxury-card flex items-center justify-between text-xs hover:border-gold-500/50 transition"
              >
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <PlayCircle className="w-4 h-4 text-gold-400" />
                  Watch Loom & Drape Video Preview
                </span>
                <span className="text-gold-400 font-bold">Open Video →</span>
              </a>
            )}
          </div>

          {/* Right: Specs, Slabs, Variants & Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {product.brand && (
                  <span className="px-2.5 py-0.5 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-[10px] font-bold uppercase tracking-wider">
                    {product.brand.name}
                  </span>
                )}
                {product.audience && (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-subtle border border-edge text-ink-secondary text-[10px] font-semibold uppercase tracking-wider">
                    {product.audience}
                  </span>
                )}
                <span className="text-[11px] font-mono text-ink-muted">
                  HSN: {product.hsn_code || "5007"} • GST {product.gst_rate ?? 5}%
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink leading-tight">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                {product.shop ? (
                  <Link
                    href={`/shop/${product.shop.slug}`}
                    className="inline-flex items-center gap-1.5 text-gold-400 font-semibold hover:underline"
                  >
                    <Store className="w-3.5 h-3.5" />
                    {product.shop.shop_name}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-gold-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Trio Dealers House Stock
                  </span>
                )}
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-gold-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {reviews.length > 0
                    ? `${(
                        reviews.reduce((a, r) => a + r.rating, 0) /
                        reviews.length
                      ).toFixed(1)} (${reviews.length} reviews)`
                    : "Verified Mill Quality"}
                </span>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="luxury-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-heading font-extrabold text-ink font-mono">
                  {formatINR(activeUnitPrice)}
                </span>
                {product.mrp && product.mrp > activeUnitPrice && (
                  <span className="text-sm text-ink-muted line-through font-mono">
                    {formatINR(product.mrp)}
                  </span>
                )}
                {mrpDiscountPct > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                    Save {mrpDiscountPct}%
                  </span>
                )}
                <span className="text-[11px] text-ink-muted ml-auto">
                  Incl. mill inspection
                </span>
              </div>

              {/* Wholesale Price Slabs */}
              {product.sell_b2b && slabs.length > 0 && (
                <div className="pt-3 border-t border-edge space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gold-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Building2 className="w-3.5 h-3.5" />
                      B2B Wholesale Price Slabs
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      MOQ: {product.b2b_moq || slabs[0].min_qty} units
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {slabs.map((slab) => {
                      const activeSlab = quantity >= slab.min_qty;
                      return (
                        <button
                          key={slab.id}
                          type="button"
                          onClick={() => setQuantity(slab.min_qty)}
                          className={`p-3 rounded-2xl border text-left transition ${
                            activeSlab
                              ? "border-gold-500 bg-gold-500/12"
                              : "border-edge bg-surface-subtle hover:border-gold-500/40"
                          }`}
                        >
                          <p className="text-[10px] font-mono uppercase text-ink-muted">
                            {slab.min_qty}+ Pcs
                          </p>
                          <p className="text-sm font-bold font-mono text-ink mt-0.5">
                            {formatINR(slab.unit_price)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Variants & Stock */}
            {activeVariants.length > 0 && (
              <div className="luxury-card rounded-3xl p-5 sm:p-6 space-y-5">
                {colors.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">Colorway</span>
                      <span className="text-gold-400 font-semibold">
                        {selectedColor}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {colors.map(({ color, hex }) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                            selectedColor === color
                              ? "border-gold-500 bg-gold-500/12 text-ink font-bold"
                              : "border-edge bg-surface-subtle text-ink-secondary hover:text-ink"
                          }`}
                        >
                          {hex && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-edge-strong shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                          )}
                          <span>{color}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sizesForColor.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">Cut / Size</span>
                      {selectedVariant && (
                        <span className="text-[11px] font-mono text-ink-muted">
                          Stock: {selectedVariant.stock_qty} available
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sizesForColor.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedSize(v.size)}
                          disabled={v.stock_qty <= 0}
                          className={`px-4 py-2 rounded-xl border text-xs font-semibold transition ${
                            selectedVariant?.id === v.id
                              ? "border-gold-500 bg-gold-500 text-black font-bold"
                              : v.stock_qty <= 0
                              ? "border-edge bg-surface-subtle text-ink-muted opacity-50 cursor-not-allowed line-through"
                              : "border-edge bg-surface-subtle text-ink-secondary hover:text-ink"
                          }`}
                        >
                          {v.size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity Picker & Add to Cart */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <div className="inline-flex items-center justify-between border border-edge rounded-xl bg-surface-input p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3.5 py-2 text-ink-secondary hover:text-ink text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="px-4 font-mono font-bold text-xs text-ink">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(
                          Math.min(
                            selectedVariant?.stock_qty || 9999,
                            quantity + 1
                          )
                        )
                      }
                      className="px-3.5 py-2 text-ink-secondary hover:text-ink text-sm font-bold"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!selectedVariant || selectedVariant.stock_qty <= 0}
                    className="flex-1 btn-gold-luxury py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {selectedVariant && selectedVariant.stock_qty > 0
                        ? `Add to Cart (${formatINR(lineTotal)})`
                        : "Out of Stock"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {addedToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Added to order bag! Opening drawer...</span>
              </div>
            )}

            {/* Description & Textile Details */}
            <div className="luxury-card rounded-3xl p-5 sm:p-6 space-y-4 text-xs">
              <h2 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <Layers className="w-4 h-4 text-gold-400" />
                Fabric & Mill Specifications
              </h2>
              {product.description && (
                <p className="text-ink-secondary leading-relaxed">
                  {product.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {product.fabric && (
                  <div className="p-3 rounded-xl bg-surface-subtle border border-edge">
                    <span className="text-[10px] uppercase text-ink-muted block">
                      Fabric Composition
                    </span>
                    <span className="font-semibold text-ink">
                      {product.fabric}
                    </span>
                  </div>
                )}
                {product.fit && (
                  <div className="p-3 rounded-xl bg-surface-subtle border border-edge">
                    <span className="text-[10px] uppercase text-ink-muted block">
                      Drape / Fit
                    </span>
                    <span className="font-semibold text-ink">
                      {product.fit}
                    </span>
                  </div>
                )}
                {product.pattern && (
                  <div className="p-3 rounded-xl bg-surface-subtle border border-edge">
                    <span className="text-[10px] uppercase text-ink-muted block">
                      Weave / Pattern
                    </span>
                    <span className="font-semibold text-ink">
                      {product.pattern}
                    </span>
                  </div>
                )}
                {product.occasion && (
                  <div className="p-3 rounded-xl bg-surface-subtle border border-edge">
                    <span className="text-[10px] uppercase text-ink-muted block">
                      Occasion
                    </span>
                    <span className="font-semibold text-ink">
                      {product.occasion}
                    </span>
                  </div>
                )}
              </div>

              {product.care_instructions && (
                <div className="p-3.5 rounded-xl bg-surface-subtle border border-edge space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gold-400">
                    Care Instructions
                  </span>
                  <p className="text-ink-secondary">
                    {product.care_instructions}
                  </p>
                </div>
              )}
            </div>

            {/* Size Chart */}
            {product.size_chart?.chart &&
              product.size_chart.chart.columns?.length > 0 && (
                <div className="luxury-card rounded-3xl p-5 sm:p-6 space-y-3 text-xs">
                  <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gold-400" />
                    Measurement Chart ({product.size_chart.name})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-edge text-[10px] uppercase text-ink-muted">
                          {product.size_chart.chart.columns.map((col, idx) => (
                            <th key={idx} className="py-2 pr-4 font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-edge">
                        {product.size_chart.chart.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="text-ink-secondary">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`py-2 pr-4 ${
                                  cIdx === 0 ? "font-bold text-ink" : ""
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* WhatsApp Direct Concierge */}
            <div className="luxury-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-ink">
                    Need Customized Saree Length or Video Sample?
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    Our Surat fabric concierges reply within 10 minutes
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/${
                  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210"
                }?text=Hi%20Trio%20Dealers,%20I%20am%20inquiring%20about%20${encodeURIComponent(
                  product.name
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition text-center shrink-0"
              >
                WhatsApp Desk
              </a>
            </div>
          </div>
        </div>

        {/* Verified Reviews Section */}
        <div className="pt-10 border-t border-edge space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
                <Star className="w-5 h-5 text-gold-400 fill-current" />
                Verified Customer & Boutique Reviews
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Authentic feedback from verified purchasers of this textile piece.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="px-4 py-2.5 rounded-xl bg-surface border border-gold-500/40 text-gold-400 hover:bg-gold-500/10 text-xs font-bold transition inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Write Verified Review
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="luxury-card rounded-3xl p-8 text-center text-xs text-ink-muted">
              No reviews yet for this textile piece. Be the first purchaser to share feedback!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="luxury-card rounded-3xl p-6 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex text-gold-400">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-ink">
                        {rev.title}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                      Verified Purchase
                    </span>
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed">
                    &ldquo;{rev.comment}&rdquo;
                  </p>

                  <div className="text-[11px] text-ink-muted pt-2 border-t border-edge flex items-center justify-between">
                    <span>{rev.user?.full_name || "Boutique Buyer"}</span>
                    <span>{formatDate(rev.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ProductInteractiveAddons
          productId={product.id}
          variantId={selectedVariant?.id}
          shopId={product.shop_id}
          shopName={product.shop?.shop_name}
          stockQty={selectedVariant?.stock_qty ?? 0}
        />

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="luxury-card-elevated border border-gold-500/40 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-heading font-bold text-ink flex items-center gap-2">
                <Star className="w-5 h-5 text-gold-400 fill-current" />
                Rate Your Purchase
              </h3>

              {reviewError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs">
                  {reviewError}
                </div>
              )}

              <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-ink-secondary font-semibold mb-1.5">
                    Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReviewRating(num)}
                        className={`px-3 py-2 rounded-xl border font-bold transition ${
                          reviewRating >= num
                            ? "border-gold-500 text-gold-400 bg-gold-500/12"
                            : "border-edge text-ink-muted"
                        }`}
                      >
                        ★ {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-ink-secondary font-semibold mb-1">
                    Review Headline
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stunning Zari Weave & Drape"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs outline-none focus:border-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-ink-secondary font-semibold mb-1">
                    Your Detailed Experience
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Tell other buyers about texture, color accuracy, packaging..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink text-xs outline-none focus:border-gold-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-gold-luxury px-5 py-2 rounded-xl uppercase tracking-wider"
                  >
                    Post Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
