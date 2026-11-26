"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchBrands,
  fetchCategories,
  fetchPublicProducts,
} from "@/lib/db";
import { Brand, Category, Product } from "@/types/database";
import { ProductCard } from "@/components/ui/product-card";
import { formatINR } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  Building2,
  Package,
} from "lucide-react";

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("q") || searchParams.get("search") || ""
  );
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [selectedBrand, setSelectedBrand] = useState(
    searchParams.get("brand") || "all"
  );
  const [selectedAudience, setSelectedAudience] = useState(
    searchParams.get("audience") || "all"
  );
  const [b2bOnly, setB2bOnly] = useState(
    searchParams.get("b2b") === "true" || searchParams.get("b2b") === "1"
  );
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sortBy, setSortBy] = useState<
    "newest" | "price_asc" | "price_desc" | "name_asc"
  >("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync URL query params when navigating via navbar
  useEffect(() => {
    setSelectedCategory(searchParams.get("category") || "all");
    setSearchTerm(searchParams.get("q") || searchParams.get("search") || "");
    setSelectedBrand(searchParams.get("brand") || "all");
    setSelectedAudience(searchParams.get("audience") || "all");
    setB2bOnly(
      searchParams.get("b2b") === "true" || searchParams.get("b2b") === "1"
    );
  }, [searchParams]);

  useEffect(() => {
    async function loadCatalog() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [prods, cats, brs] = await Promise.all([
        fetchPublicProducts(supabase),
        fetchCategories(supabase),
        fetchBrands(supabase),
      ]);
      setProducts(prods);
      setCategories(cats);
      setBrands(brs);
      setLoading(false);
    }
    loadCatalog();
  }, []);

  // Build hierarchical matching IDs when a parent category is selected
  const matchingCategoryIds = useMemo(() => {
    if (selectedCategory === "all") return null;
    const cat = categories.find(
      (c) => c.slug === selectedCategory || c.id === selectedCategory
    );
    if (!cat) return new Set<string>();
    const ids = new Set<string>([cat.id]);
    categories
      .filter((child) => child.parent_id === cat.id)
      .forEach((child) => ids.add(child.id));
    return ids;
  }, [selectedCategory, categories]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const result = products.filter((p) => {
      if (query) {
        const hay = `${p.name} ${p.fabric || ""} ${p.description || ""} ${
          p.category?.name || ""
        } ${p.brand?.name || ""} ${p.shop?.shop_name || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (matchingCategoryIds) {
        if (!p.category_id || !matchingCategoryIds.has(p.category_id)) {
          return false;
        }
      }

      if (selectedBrand !== "all") {
        const brandMatch =
          p.brand?.slug === selectedBrand || p.brand_id === selectedBrand;
        if (!brandMatch) return false;
      }

      if (selectedAudience !== "all") {
        if (p.audience && p.audience !== selectedAudience) return false;
        if (!p.audience) return false;
      }

      if (b2bOnly && !p.sell_b2b) return false;

      if (inStockOnly) {
        const totalStock = (p.variants || []).reduce(
          (sum, v) => sum + (v.stock_qty || 0),
          0
        );
        if (totalStock <= 0) return false;
      }

      if (p.retail_price > maxPrice) return false;

      return true;
    });

    return [...result].sort((a, b) => {
      if (sortBy === "price_asc") return a.retail_price - b.retail_price;
      if (sortBy === "price_desc") return b.retail_price - a.retail_price;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return 0; // newest already sorted descending by created_at from db
    });
  }, [
    products,
    searchTerm,
    matchingCategoryIds,
    selectedBrand,
    selectedAudience,
    b2bOnly,
    inStockOnly,
    maxPrice,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("all");
    setSelectedBrand("all");
    setSelectedAudience("all");
    setB2bOnly(false);
    setInStockOnly(false);
    setMaxPrice(100000);
    setSortBy("newest");
    router.replace("/catalog");
  };

  const parentCategories = categories.filter((c) => !c.parent_id);
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedBrand !== "all" ||
    selectedAudience !== "all" ||
    b2bOnly ||
    inStockOnly ||
    maxPrice < 25000;

  return (
    <div className="bg-canvas min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Command Header */}
        <div className="luxury-card rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Mill Direct Fabric Archive
            </span>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink">
              {b2bOnly
                ? "B2B Wholesale Textile Catalog"
                : "Retail & Wholesale Fabric Catalog"}
            </h1>
            <p className="text-xs text-ink-secondary">
              Showing{" "}
              <strong className="text-ink">{filteredProducts.length}</strong>{" "}
              authenticated weaving lots across {categories.length} departments.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search silk, cotton, mill..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-surface-input border border-edge text-xs text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-xs font-medium text-ink focus:border-gold-500 outline-none"
            >
              <option value="newest">Sort: Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
            </select>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="lg:hidden px-4 py-2.5 rounded-xl border border-edge bg-surface-subtle text-xs font-bold text-ink flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4 text-gold-400" />
              Filters
            </button>
          </div>
        </div>

        {/* Active Filter Pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted font-semibold">Active Filters:</span>
            {selectedCategory !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className="px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 font-semibold flex items-center gap-1.5"
              >
                Category: {selectedCategory}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedBrand !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedBrand("all")}
                className="px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 font-semibold flex items-center gap-1.5"
              >
                Brand: {selectedBrand}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedAudience !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedAudience("all")}
                className="px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 font-semibold capitalize flex items-center gap-1.5"
              >
                Audience: {selectedAudience}
                <X className="w-3 h-3" />
              </button>
            )}
            {b2bOnly && (
              <button
                type="button"
                onClick={() => setB2bOnly(false)}
                className="px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 font-semibold flex items-center gap-1.5"
              >
                B2B Wholesale Only
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1 rounded-full border border-edge bg-surface-subtle text-ink-secondary hover:text-ink font-semibold inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Filters */}
          <aside
            className={`lg:col-span-3 luxury-card rounded-3xl p-6 space-y-6 lg:sticky lg:top-28 ${
              mobileFiltersOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-gold-400" />
                Refine Selection
              </h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-gold-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-ink">Department</p>
              <div className="space-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`w-full text-left px-3 py-2 rounded-xl transition font-medium ${
                    selectedCategory === "all"
                      ? "bg-gold-500 text-black font-bold"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
                  }`}
                >
                  All Textile Lots
                </button>

                {parentCategories.map((cat) => {
                  const children = categories.filter(
                    (c) => c.parent_id === cat.id
                  );
                  return (
                    <div key={cat.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`w-full text-left px-3 py-2 rounded-xl transition font-medium ${
                          selectedCategory === cat.slug
                            ? "bg-gold-500 text-black font-bold"
                            : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
                        }`}
                      >
                        {cat.name}
                      </button>

                      {children.length > 0 && (
                        <div className="pl-3 space-y-1 border-l border-edge ml-3">
                          {children.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setSelectedCategory(sub.slug)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition ${
                                selectedCategory === sub.slug
                                  ? "bg-gold-500/20 text-gold-400 font-bold"
                                  : "text-ink-muted hover:text-ink"
                              }`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-2.5 pt-4 border-t border-edge">
              <p className="text-xs font-bold text-ink">Audience</p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {["all", "women", "men", "kids", "unisex"].map((aud) => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setSelectedAudience(aud)}
                    className={`px-3 py-1.5 rounded-xl capitalize font-semibold border transition ${
                      selectedAudience === aud
                        ? "bg-gold-500 text-black border-gold-500 font-bold"
                        : "bg-surface-subtle border-edge text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {aud === "all" ? "All" : aud}
                  </button>
                ))}
              </div>
            </div>

            {/* Brands */}
            {brands.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-edge">
                <p className="text-xs font-bold text-ink">Weave House / Brand</p>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-xs text-ink outline-none focus:border-gold-500"
                >
                  <option value="all">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Price Ceiling */}
            <div className="space-y-2 pt-4 border-t border-edge">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink">Max Retail Price</span>
                <span className="font-mono font-bold text-gold-400">
                  {formatINR(maxPrice)}
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={25000}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-gold-500 cursor-pointer"
              />
            </div>

            {/* B2B & Stock Toggles */}
            <div className="space-y-3 pt-4 border-t border-edge text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 font-semibold text-ink-secondary">
                  <Building2 className="w-3.5 h-3.5 text-gold-400" />
                  B2B Wholesale Eligible
                </span>
                <input
                  type="checkbox"
                  checked={b2bOnly}
                  onChange={(e) => setB2bOnly(e.target.checked)}
                  className="w-4 h-4 accent-gold-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 font-semibold text-ink-secondary">
                  <Package className="w-3.5 h-3.5 text-gold-400" />
                  In Stock Ready to Ship
                </span>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-gold-500 rounded"
                />
              </label>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="lg:col-span-9">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="luxury-card rounded-2xl overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[4/5] bg-surface-subtle" />
                    <div className="p-4 space-y-2.5">
                      <div className="h-3 w-1/3 bg-surface-subtle rounded" />
                      <div className="h-4 w-3/4 bg-surface-subtle rounded" />
                      <div className="h-5 w-1/2 bg-surface-subtle rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="luxury-card rounded-3xl p-12 text-center space-y-4">
                <Package className="w-10 h-10 text-gold-400 mx-auto" />
                <h2 className="text-lg font-heading font-bold text-ink">
                  No textile products matched your filters
                </h2>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  Try widening your price limit or resetting department filters, or request bespoke fabric sourcing via our B2B RFQ desk.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                  >
                    Reset All Filters
                  </button>
                  <Link
                    href="/b2b/rfq"
                    className="px-5 py-2.5 rounded-xl border border-edge bg-surface-subtle text-xs font-bold text-ink"
                  >
                    Request Custom RFQ
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center text-xs text-ink-muted">
          Loading Trio Dealers catalog...
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}
