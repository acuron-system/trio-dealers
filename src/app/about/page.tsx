import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { getDynamicHomePayload } from "@/lib/dynamic-store";
import { sanitizeRichText } from "@/lib/security/sanitize";
import { Sparkles, ShieldCheck, Building2, Layers, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function AboutPage() {
  const home = await getDynamicHomePayload();

  let cmsAboutHtml: string | null = null;
  let cmsTitle = "About Trio Dealers";

  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await db
      .from("cms_pages")
      .select("title, content_html")
      .eq("slug", "about")
      .eq("is_published", true)
      .maybeSingle();
    if (data?.content_html) {
      cmsTitle = data.title || cmsTitle;
      cmsAboutHtml = sanitizeRichText(data.content_html);
    }
  }

  const stats = [
    {
      label: "Verified Seller Mills",
      value: String(home.metrics.verifiedShopsCount),
    },
    {
      label: "Live Approved SKUs",
      value: String(home.metrics.approvedProductsCount),
    },
    {
      label: "Active Categories",
      value: String(home.metrics.activeCategoriesCount),
    },
    {
      label: "Active Flash Campaigns",
      value: String(home.flashSales.length),
    },
  ];

  const pillars = [
    {
      icon: Layers,
      title: "Direct Mill & Atelier Sourcing",
      description:
        "Bridging textile producers with boutique retailers and wholesale buyers through a single transparent commerce ledger.",
    },
    {
      icon: ShieldCheck,
      title: "Verified Seller KYC Governance",
      description:
        "Sellers undergo KYC verification and listing moderation before inventory goes live to retail and B2B buyers.",
    },
    {
      icon: Building2,
      title: "Retail + B2B Tiered Settlement",
      description:
        "Single-piece retail ordering alongside MOQ wholesale slabs, RFQ mill quotes, Net credit lines, and GST invoicing.",
    },
  ];

  return (
    <div className="bg-canvas py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <section className="luxury-card-elevated rounded-3xl p-8 sm:p-12 space-y-6">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {cmsTitle}
          </span>

          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-ink leading-[1.12] tracking-tight">
            India&apos;s Multi-Vendor Textile Marketplace for Retail &amp; B2B Wholesale.
          </h1>

          {cmsAboutHtml ? (
            <div
              className="prose prose-invert max-w-none text-sm text-ink-secondary leading-relaxed"
              dangerouslySetInnerHTML={{ __html: cmsAboutHtml }}
            />
          ) : (
            <p className="text-sm sm:text-base text-ink-secondary leading-relaxed max-w-3xl">
              Manage or customize this About section at any time via Admin -&gt; CMS &amp; Settings (`/admin/cms`) under slug `about`.
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/catalog"
              className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
            >
              Browse Catalog <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/shops"
              className="px-5 py-3 rounded-xl border border-edge bg-surface hover:border-gold-500/50 text-xs font-bold text-ink"
            >
              Partner Mills Directory
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((st) => (
            <div key={st.label} className="luxury-card rounded-2xl p-5 text-center space-y-1">
              <p className="text-3xl font-heading font-extrabold text-gold-400 font-mono">
                {st.value}
              </p>
              <p className="text-xs text-ink-muted">{st.label}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="luxury-card rounded-3xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gold-500/15 text-gold-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-base font-heading font-bold text-ink">{p.title}</h2>
                <p className="text-xs text-ink-secondary leading-relaxed">{p.description}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
