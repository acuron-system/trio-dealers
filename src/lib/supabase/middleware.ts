import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig, isSupabaseConfigured } from "./config";
import { applySecurityHeaders } from "@/lib/security/headers";
import { assertSameOrigin, getSafeRedirectTarget } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const PROTECTED_PREFIXES = [
  "/admin",
  "/shop-dashboard",
  "/seller/products",
  "/seller/payouts",
  "/seller/returns",
  "/seller/engagement",
  "/seller/coupons",
  "/seller/orders",
  "/b2b/dashboard",
  "/b2b/rfq",
  "/b2b/lists",
  "/b2b/team",
  "/transporter",
  "/account",
  "/orders",
];

const PUBLIC_API_EXEMPTIONS = new Set([
  "/api/payments/razorpay/webhook",
]);

function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = generateNonce();

  // Enforce CSRF Same-Origin validation for mutating API endpoints (except signed webhooks)
  if (
    pathname.startsWith("/api/") &&
    !PUBLIC_API_EXEMPTIONS.has(pathname)
  ) {
    const csrfError = assertSameOrigin(request);
    if (csrfError) {
      return applySecurityHeaders(csrfError, nonce);
    }

    const rl = await checkRateLimit("general_api", getClientIp(request));
    if (!rl.allowed) {
      const rateLimited = NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429 }
      );
      return applySecurityHeaders(rateLimited, nonce);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!isSupabaseConfigured()) {
    return applySecurityHeaders(supabaseResponse, nonce);
  }

  const { url, anonKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/register-shop" ||
    pathname === "/seller/register" ||
    pathname === "/b2b/register";

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", getSafeRedirectTarget(pathname));
    return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (profile && !profile.is_active) {
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/login";
      suspendedUrl.searchParams.set("error", "suspended");
      if (!isAuthPage) {
        return applySecurityHeaders(NextResponse.redirect(suspendedUrl), nonce);
      }
    }

    const role = profile?.role || "user";

    // Block transporters from browsing marketplace retail catalog/products
    if (role === "transporter" && (pathname.startsWith("/catalog") || pathname.startsWith("/product"))) {
      const transporterUrl = request.nextUrl.clone();
      transporterUrl.pathname = "/transporter";
      return applySecurityHeaders(NextResponse.redirect(transporterUrl), nonce);
    }

    if (pathname.startsWith("/admin")) {
      if (role !== "admin") {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        return applySecurityHeaders(NextResponse.redirect(homeUrl), nonce);
      }

      // Enforce AAL2 (TOTP MFA) for Admin once enrolled, allowing /admin/security enrollment route
      if (!pathname.startsWith("/admin/security")) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          const mfaUrl = request.nextUrl.clone();
          mfaUrl.pathname = "/login";
          mfaUrl.searchParams.set("mfa", "required");
          mfaUrl.searchParams.set("redirect", getSafeRedirectTarget(pathname, "/admin"));
          return applySecurityHeaders(NextResponse.redirect(mfaUrl), nonce);
        }
      }
    }

    const isSellerRoute =
      pathname.startsWith("/shop-dashboard") || pathname.startsWith("/seller");
    if (isSellerRoute && role !== "shop" && role !== "admin") {
      if (!pathname.startsWith("/seller/register")) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        return applySecurityHeaders(NextResponse.redirect(homeUrl), nonce);
      }
    }

    if (pathname.startsWith("/b2b") && !pathname.startsWith("/b2b/register") && role !== "b2b" && role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return applySecurityHeaders(NextResponse.redirect(homeUrl), nonce);
    }

    if (pathname.startsWith("/transporter") && role !== "transporter" && role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return applySecurityHeaders(NextResponse.redirect(homeUrl), nonce);
    }
  }

  return applySecurityHeaders(supabaseResponse, nonce);
}
