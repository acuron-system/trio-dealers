import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { Store, MapPin, ShieldCheck, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function ShopsDirectoryPage() {
  let shops: any[] = [];

  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await db
      .from("shops")
      .select("id, shop_name, slug, description, city, state, logo_url, kyc_status")
      .eq("kyc_status", "approved")
      .eq("is_suspended", false)
      .order("created_at", { ascending: false });

    shops = data || [];
  }

  return (
    <div className="min-h-screen bg-canvas py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <Store className="w-3.5 h-3.5" /> Partner Mills Directory
          </span>
          <h1 className="text-3xl font-heading font-black text-ink mt-2">
            Verified Textile Sellers &amp; Houses
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Browse KYC-approved mills, silk weavers, and apparel houses supplying retail and wholesale stock.
          </p>
        </div>

        {shops.length === 0 ? (
          <div className="luxury-card rounded-3xl p-10 text-center space-y-3">
            <Store className="w-9 h-9 text-gold-400 mx-auto" />
            <p className="text-sm font-bold text-ink">No verified seller shops listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                className="luxury-card rounded-2xl p-6 space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase">
                    <ShieldCheck className="w-3 h-3" /> KYC Approved
                  </span>
                  {shop.city && (
                    <span className="text-[11px] text-ink-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gold-400" />
                      {shop.city}, {shop.state}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-heading font-bold text-ink group-hover:text-gold-400 transition">
                  {shop.shop_name}
                </h2>
                {shop.description && (
                  <p className="text-xs text-ink-muted line-clamp-2">{shop.description}</p>
                )}

                <span className="inline-flex items-center gap-1 text-xs font-bold text-gold-400 pt-1">
                  Visit Storefront <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

