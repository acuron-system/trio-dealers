import Link from "next/link";
import Image from "next/image";
import { getDynamicHomePayload } from "@/lib/dynamic-store";
import { getPublicSiteConfig } from "@/lib/site-config";
import { ProductCard } from "@/components/ui/product-card";
import {
  DynamicB2BMarginCalculator,
  LiveFlashCountdown,
} from "@/components/store/home-interactive";
import {
  ArrowRight,
  Building2,
  Layers,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

export const revalidate = 60;

export default async function HomePage() {
  const [home, siteConfig] = await Promise.all([
    getDynamicHomePayload(),
    getPublicSiteConfig(),
  ]);

  const heroBanner =
    home.banners.find((b) => b.placement === "hero") || home.banners[0] || null;
  const parentCategories = home.categories.filter((c) => !c.parent_id).slice(0, 6);
  const displayCategories =
    parentCategories.length > 0 ? parentCategories : home.categories.slice(0, 6);

  return (
    <div className="bg-canvas text-ink">
      {/* 1. DYNAMIC HERO SECTION (Reads active banner / site brand from DB) */}
      <section className="relative overflow-hidden border-b border-edge">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-0 w-[560px] h-[560px] rounded-full bg-gold-500/10 blur-3xl"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                {siteConfig.brandName} • {siteConfig.brandTagline}
              </div>

              <h1 className="text-3xl sm:text-5xl font-heading font-black text-ink tracking-tight leading-[1.08]">
                {heroBanner?.title || "Direct-from-Mill Retail & B2B Wholesale Textile Marketplace"}
              </h1>

              <p className="text-sm sm:text-base text-ink-secondary max-w-2xl leading-relaxed">
                {heroBanner?.subtitle ||
                  "Discover curated handloom silks, suiting cuts, and bulk commercial bolts directly from verified Indian textile mills with GST-ready invoicing."}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={heroBanner?.cta_href || "/catalog"}
                  className="btn-gold-luxury px-6 py-3.5 rounded-xl text-xs uppercase tracking-widest inline-flex items-center gap-2"
                >
                  <span>{heroBanner?.cta_label || "Explore Fabric Catalog"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/b2b/register"
                  className="px-5 py-3.5 rounded-xl border border-gold-500/40 bg-surface hover:border-gold-500 text-xs font-bold uppercase tracking-wider text-gold-400 inline-flex items-center gap-2 transition"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Wholesale B2B Desk</span>
                </Link>

                <Link
                  href="/seller/register"
                  className="px-5 py-3.5 rounded-xl border border-edge bg-surface hover:border-edge-strong text-xs font-semibold text-ink inline-flex items-center gap-2 transition"
                >
                  <Store className="w-4 h-4 text-gold-400" />
                  <span>Sell as a Mill</span>
                </Link>
              </div>

              {/* Real Database Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-5 border-t border-edge max-w-lg">
                <div>
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-gold-400 font-mono">
                    {home.metrics.approvedProductsCount}
                  </p>
                  <p className="text-[11px] text-ink-muted">Live Approved SKUs</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-ink font-mono">
                    {home.metrics.verifiedShopsCount}
                  </p>
                  <p className="text-[11px] text-ink-muted">Verified Mills &amp; Shops</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-ink font-mono">
                    {home.metrics.activeCategoriesCount}
                  </p>
                  <p className="text-[11px] text-ink-muted">Textile Categories</p>
                </div>
              </div>
            </div>

            {/* Dynamic Hero Banner Visual */}
            <div className="lg:col-span-5">
              {heroBanner?.image_url ? (
                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-gold-500/40 shadow-luxury bg-surface">
                  <Image
                    src={heroBanner.image_url}
                    alt={heroBanner.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="luxury-card-elevated rounded-3xl p-8 text-center space-y-4 border border-edge">
                  <ShieldCheck className="w-10 h-10 text-gold-400 mx-auto" />
                  <h2 className="text-lg font-heading font-bold text-ink">
                    100% Database-Driven Storefront
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Hero banners, collections, flash deals, and featured fabrics appear here automatically once added in Admin -&gt; Homepage &amp; Banners.
                  </p>
                  <Link
                    href="/admin/homepage"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-400 hover:underline"
                  >
                    Configure Homepage Banners →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. DYNAMIC FLASH SALES (Only shown when active timed sales exist in DB) */}
      {home.flashSales.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="luxury-card rounded-3xl p-6 sm:p-8 border border-gold-500/35 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-gold-400" />
                <h2 className="text-xl font-heading font-extrabold text-ink">
                  Flash Mill Deals
                </h2>
              </div>
              <Link
                href="/deals"
                className="text-xs font-bold text-gold-400 hover:underline inline-flex items-center gap-1"
              >
                All Deals &amp; Coupons <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {home.flashSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 rounded-2xl bg-surface border border-edge flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                      {sale.discount_percent}% OFF
                    </p>
                    <p className="text-sm font-bold text-ink">{sale.title}</p>
                    {sale.product && (
                      <Link
                        href={`/product/${sale.product.slug}`}
                        className="text-xs text-ink-secondary hover:text-gold-400 block"
                      >
                        {sale.product.name} →
                      </Link>
                    )}
                  </div>
                  <LiveFlashCountdown endsAt={sale.ends_at} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. DYNAMIC CATEGORIES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Shop by Textile Category
            </p>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink mt-1">
              Curated Categories
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-xs font-bold text-gold-400 hover:underline inline-flex items-center gap-1"
          >
            Browse All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {displayCategories.length === 0 ? (
          <div className="luxury-card rounded-2xl p-8 text-center text-xs text-ink-muted">
            No active categories found in the database yet. Admin can create textile categories from Admin -&gt; Categories.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {displayCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
                className="luxury-card rounded-2xl overflow-hidden group flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-surface-subtle overflow-hidden flex items-center justify-center">
                  {cat.image_url ? (
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <Layers className="w-7 h-7 text-gold-400/50" />
                  )}
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs font-bold text-ink group-hover:text-gold-400 transition truncate">
                    {cat.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. DYNAMIC FEATURED PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Verified Inventory
            </p>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink mt-1">
              Latest Mill Arrivals
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-xs font-bold text-gold-400 hover:underline inline-flex items-center gap-1"
          >
            View Catalog <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {home.featuredProducts.length === 0 ? (
          <div className="luxury-card rounded-3xl p-10 text-center space-y-3">
            <Package className="w-9 h-9 text-gold-400 mx-auto" />
            <h3 className="text-base font-heading font-bold text-ink">
              No Approved Products Published Yet
            </h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              Approve seller listings or run seed scripts in Supabase so approved fabrics appear dynamically here.
            </p>
            <Link
              href="/seller/products"
              className="inline-flex items-center gap-2 btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider"
            >
              Add Seller Product
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {home.featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 5. DYNAMIC B2B SIMULATOR (Only renders when a live B2B product exists in DB) */}
      {home.sampleB2BProduct && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <DynamicB2BMarginCalculator product={home.sampleB2BProduct} />
        </section>
      )}
    </div>
  );
}
