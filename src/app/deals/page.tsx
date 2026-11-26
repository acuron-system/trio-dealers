import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { LiveFlashCountdown } from "@/components/store/home-interactive";
import { Tag, Zap, Layers, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function DealsPage() {
  let flashSales: any[] = [];
  let bundles: any[] = [];
  let coupons: any[] = [];

  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const nowIso = new Date().toISOString();

    const [{ data: fs }, { data: bd }, { data: cp }] = await Promise.all([
      db
        .from("flash_sales")
        .select("*, product:products(id, name, slug, retail_price)")
        .eq("is_active", true)
        .gte("ends_at", nowIso)
        .order("ends_at", { ascending: true }),
      db.from("bundles").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      db
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .gte("valid_to", nowIso)
        .order("valid_to", { ascending: true }),
    ]);

    flashSales = fs || [];
    bundles = bd || [];
    coupons = cp || [];
  }

  return (
    <div className="min-h-screen bg-canvas py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" /> Active Deals &amp; Trade Promotions
          </span>
          <h1 className="text-3xl font-heading font-black text-ink">
            Flash Sales, Textile Bundles &amp; Coupons
          </h1>
          <p className="text-sm text-ink-muted">
            All offers below are served live from active promotional campaigns in the database.
          </p>
        </div>

        {/* Flash Sales */}
        <section className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold-400" /> Timed Flash Sales
          </h2>
          {flashSales.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No active flash sales right now. Check back soon or create one in Admin -&gt; Marketing.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {flashSales.map((s) => (
                <div key={s.id} className="luxury-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-gold-500 text-black text-xs font-black">
                      {s.discount_percent}% OFF
                    </span>
                    <LiveFlashCountdown endsAt={s.ends_at} />
                  </div>
                  <h3 className="text-base font-bold text-ink">{s.title}</h3>
                  {s.product && (
                    <Link
                      href={`/product/${s.product.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gold-400 hover:underline"
                    >
                      Shop {s.product.name} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bundles */}
        <section className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold-400" /> Curated Textile Bundles
          </h2>
          {bundles.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No active fabric bundles available right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bundles.map((b) => (
                <div key={b.id} className="luxury-card rounded-2xl p-5 space-y-2">
                  <h3 className="text-base font-bold text-ink">{b.title}</h3>
                  {b.description && <p className="text-xs text-ink-muted">{b.description}</p>}
                  <p className="text-lg font-mono font-bold text-gold-400">
                    ₹{Number(b.bundle_price).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Coupons */}
        <section className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            <Tag className="w-4 h-4 text-gold-400" /> Active Promo Coupons
          </h2>
          {coupons.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No active promo codes currently listed.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map((c) => (
                <div key={c.id} className="luxury-card rounded-2xl p-5 space-y-2 border border-gold-500/30">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-base text-gold-400">
                      {c.code}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-surface-subtle border border-edge uppercase font-semibold">
                      {c.scope || "all"}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    {c.discount_type === "percentage"
                      ? `${c.discount_value}% off (up to ₹${c.max_discount})`
                      : `Flat ₹${c.discount_value} off`}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    Min order: ₹{Number(c.min_order_value || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

