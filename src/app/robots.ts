import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://triodealers.in").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalog", "/product/", "/shop/", "/pages/", "/deals"],
        disallow: [
          "/admin",
          "/api/",
          "/seller/",
          "/shop-dashboard",
          "/b2b/dashboard",
          "/transporter",
          "/account",
          "/checkout",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

