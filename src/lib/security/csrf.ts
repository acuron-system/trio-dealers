import { NextResponse } from "next/server";

/**
 * Validates same-origin CSRF expectations for cookie-authenticated mutating API requests.
 * Rejects requests whose Origin or Referer points to a different host.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const allowedHosts = new Set<string>();
  if (host) allowedHosts.add(host.toLowerCase());
  if (configuredSiteUrl) {
    try {
      allowedHosts.add(new URL(configuredSiteUrl).host.toLowerCase());
    } catch {
      // ignore invalid NEXT_PUBLIC_SITE_URL
    }
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!allowedHosts.has(originHost)) {
        return NextResponse.json(
          { error: "Cross-origin request rejected." },
          { status: 403 }
        );
      }
      return null;
    } catch {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }
  }

  if (referer) {
    try {
      const refHost = new URL(referer).host.toLowerCase();
      if (!allowedHosts.has(refHost)) {
        return NextResponse.json(
          { error: "Cross-origin referer rejected." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request referer." },
        { status: 403 }
      );
    }
  }

  return null;
}

/**
 * Prevents open-redirect vulnerabilities by ensuring targets stay on relative paths.
 */
export function getSafeRedirectTarget(
  target: string | null | undefined,
  fallback = "/"
): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Extracts normalized client IP and User-Agent headers for audit logs and rate limits.
 */
export function getRequestAuditMeta(request: Request): {
  ip: string;
  userAgent: string;
} {
  const xff = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const ip =
    cfIp ||
    (xff ? xff.split(",")[0]?.trim() : null) ||
    realIp ||
    "127.0.0.1";
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(
    0,
    300
  );
  return { ip, userAgent };
}

