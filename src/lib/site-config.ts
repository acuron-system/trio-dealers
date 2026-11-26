import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export interface NavCategory {
  id: string;
  name: string;
  slug: string;
}

export interface NavCmsLink {
  slug: string;
  title: string;
}

export interface PublicSiteConfig {
  brandName: string;
  brandTagline: string;
  announcement: {
    enabled: boolean;
    text: string | null;
    linkUrl: string | null;
  };
  contact: {
    phone: string | null;
    email: string | null;
    whatsappNumber: string | null;
    address: string | null;
    gstin: string | null;
    supportHours: string | null;
  };
  shipping: {
    freeAbove: number | null;
    defaultCharge: number | null;
  };
  featureFlags: Record<string, boolean>;
  categories: NavCategory[];
  cmsLinks: NavCmsLink[];
}

const EMPTY_CONFIG: PublicSiteConfig = {
  brandName: "TRIO DEALERS",
  brandTagline: "Retail & Wholesale Cloth",
  announcement: {
    enabled: false,
    text: null,
    linkUrl: null,
  },
  contact: {
    phone: null,
    email: null,
    whatsappNumber: null,
    address: null,
    gstin: null,
    supportHours: null,
  },
  shipping: {
    freeAbove: null,
    defaultCharge: null,
  },
  featureFlags: {},
  categories: [],
  cmsLinks: [],
};

async function fetchPublicSiteConfigRaw(): Promise<PublicSiteConfig> {
  if (!isSupabaseConfigured()) {
    return EMPTY_CONFIG;
  }

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: settingsRows }, { data: categoryRows }, { data: cmsRows }] =
      await Promise.all([
        db.from("settings").select("key, value"),
        db
          .from("categories")
          .select("id, name, slug")
          .is("parent_id", null)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(6),
        db
          .from("cms_pages")
          .select("slug, title")
          .eq("is_published", true)
          .order("slug", { ascending: true }),
      ]);

    const settingsMap = new Map<string, Record<string, any>>();
    for (const row of settingsRows || []) {
      if (row?.key && row?.value && typeof row.value === "object") {
        settingsMap.set(row.key, row.value as Record<string, any>);
      }
    }

    const brand = settingsMap.get("site_brand") || {};
    const announcement = settingsMap.get("announcement_bar") || {};
    const contact = settingsMap.get("contact_info") || {};
    const shipping = settingsMap.get("shipping_rules") || {};
    const flags = settingsMap.get("feature_flags") || {};

    return {
      brandName: typeof brand.name === "string" && brand.name ? brand.name : "TRIO DEALERS",
      brandTagline:
        typeof brand.tagline === "string" && brand.tagline
          ? brand.tagline
          : "Retail & Wholesale Cloth",
      announcement: {
        enabled: Boolean(announcement.enabled),
        text: typeof announcement.text === "string" && announcement.text ? announcement.text : null,
        linkUrl:
          typeof announcement.link_url === "string" && announcement.link_url
            ? announcement.link_url
            : null,
      },
      contact: {
        phone: typeof contact.phone === "string" && contact.phone ? contact.phone : null,
        email: typeof contact.email === "string" && contact.email ? contact.email : null,
        whatsappNumber:
          typeof contact.whatsapp === "string" && contact.whatsapp ? contact.whatsapp : null,
        address: typeof contact.address === "string" && contact.address ? contact.address : null,
        gstin: typeof contact.gstin === "string" && contact.gstin ? contact.gstin : null,
        supportHours:
          typeof contact.hours === "string" && contact.hours ? contact.hours : null,
      },
      shipping: {
        freeAbove:
          typeof shipping.free_above === "number" ? shipping.free_above : null,
        defaultCharge:
          typeof shipping.default_charge === "number" ? shipping.default_charge : null,
      },
      featureFlags: Object.fromEntries(
        Object.entries(flags).map(([k, v]) => [k, Boolean(v)])
      ),
      categories: (categoryRows || []).map((c: any) => ({
        id: String(c.id),
        name: String(c.name),
        slug: String(c.slug),
      })),
      cmsLinks: (cmsRows || []).map((p: any) => ({
        slug: String(p.slug),
        title: String(p.title),
      })),
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

export const getPublicSiteConfig = unstable_cache(
  fetchPublicSiteConfigRaw,
  ["public-site-config"],
  {
    revalidate: 120,
    tags: ["settings", "categories", "cms"],
  }
);

