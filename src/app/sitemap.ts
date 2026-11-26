import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://triodealers.in").replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/deals`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/shops`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/compare`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
  ];

  if (!isSupabaseConfigured()) {
    return staticRoutes;
  }

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: products }, { data: shops }, { data: cms }] = await Promise.all([
      db
        .from("products")
        .select("slug, updated_at")
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(500),
      db
        .from("shops")
        .select("slug, updated_at")
        .eq("kyc_status", "approved")
        .eq("is_suspended", false)
        .limit(200),
      db.from("cms_pages").select("slug, updated_at").eq("is_published", true).limit(50),
    ]);

    const productUrls: MetadataRoute.Sitemap = (products || []).map((p: any) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const shopUrls: MetadataRoute.Sitemap = (shops || []).map((s: any) => ({
      url: `${siteUrl}/shop/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const cmsUrls: MetadataRoute.Sitemap = (cms || []).map((c: any) => ({
      url: `${siteUrl}/pages/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.5,
    }));

    return [...staticRoutes, ...productUrls, ...shopUrls, ...cmsUrls];
  } catch {
    return staticRoutes;
  }
}

