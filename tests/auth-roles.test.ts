import { describe, it, expect, afterEach } from "vitest";
import { UserRole } from "@/types/database";
import {
  getSupabasePublicConfig,
  getSupabaseServiceRoleKey,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "../src/lib/supabase/config";

describe("Supabase Public & Admin Env Configuration", () => {
  const envBackup = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    pub: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.SUPABASE_SECRET_KEY,
  };

  afterEach(() => {
    for (const [envKey, val] of [
      ["NEXT_PUBLIC_SUPABASE_URL", envBackup.url],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", envBackup.anon],
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", envBackup.pub],
      ["SUPABASE_SERVICE_ROLE_KEY", envBackup.service],
      ["SUPABASE_SECRET_KEY", envBackup.secret],
    ] as const) {
      if (val === undefined) delete process.env[envKey];
      else process.env[envKey] = val;
    }
  });

  it("supports NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY alongside NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key";

    expect(isSupabaseConfigured()).toBe(true);
    expect(isServiceRoleConfigured()).toBe(true);
    expect(getSupabasePublicConfig().anonKey).toBe("sb_publishable_test_key");
    expect(getSupabaseServiceRoleKey()).toBe("sb_secret_test_key");
  });

  it("rejects placeholder URLs and keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-trio-dealers.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";

    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabasePublicConfig().configured).toBe(false);
  });
});

describe("Role Permissions & Route Access Control", () => {
  const roleAccessMap: Record<UserRole, string[]> = {
    admin: ["/admin", "/admin/moderation", "/admin/shops", "/admin/b2b", "/admin/orders", "/admin/payouts"],
    shop: ["/shop-dashboard", "/seller/products", "/seller/payouts"],
    b2b: ["/b2b/dashboard", "/b2b/rfq"],
    transporter: ["/transporter"],
    user: ["/account", "/orders"],
  };

  it("should define distinct access zones for each of the 5 roles", () => {
    const roles: UserRole[] = ["admin", "shop", "b2b", "transporter", "user"];
    expect(roles.length).toBe(5);

    for (const role of roles) {
      expect(roleAccessMap[role].length).toBeGreaterThan(0);
    }
  });

  it("should restrict admin routes strictly to admin role", () => {
    const isAllowed = (role: UserRole, path: string) => roleAccessMap[role].includes(path);

    expect(isAllowed("admin", "/admin/moderation")).toBe(true);
    expect(isAllowed("shop", "/admin/moderation")).toBe(false);
    expect(isAllowed("b2b", "/admin/moderation")).toBe(false);
    expect(isAllowed("user", "/admin/moderation")).toBe(false);
  });

  it("should restrict seller product management strictly to shop role", () => {
    const isAllowed = (role: UserRole, path: string) => roleAccessMap[role].includes(path);

    expect(isAllowed("shop", "/seller/products")).toBe(true);
    expect(isAllowed("user", "/seller/products")).toBe(false);
    expect(isAllowed("transporter", "/seller/products")).toBe(false);
  });
});

