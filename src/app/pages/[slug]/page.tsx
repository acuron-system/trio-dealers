import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeRichText } from "@/lib/security/sanitize";
import { ArrowLeft } from "lucide-react";

export const revalidate = 120;

export default async function DynamicCmsPage({
  params,
}: {
  params: { slug: string };
}) {
  const cleanSlug = decodeURIComponent(params.slug || "").trim().toLowerCase();
  if (!cleanSlug) notFound();

  let page: { title: string; content_html: string } | null = null;

  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await db
      .from("cms_pages")
      .select("title, content_html")
      .eq("slug", cleanSlug)
      .eq("is_published", true)
      .maybeSingle();

    if (data) {
      page = data as any;
    }
  }

  if (!page) {
    notFound();
  }

  const safeHtml = sanitizeRichText(page.content_html || "");

  return (
    <div className="min-h-screen bg-canvas py-12 px-4">
      <div className="max-w-4xl mx-auto luxury-card-elevated rounded-3xl p-8 sm:p-12 space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <h1 className="text-3xl font-heading font-extrabold text-ink">
          {page.title}
        </h1>

        <div
          className="prose prose-invert max-w-none text-sm text-ink-secondary leading-relaxed space-y-4"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    </div>
  );
}

