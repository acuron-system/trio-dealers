const PLACEHOLDER_URL = "https://placeholder-trio-dealers.supabase.co";
const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key";

function readPublicAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Resolves the server-side admin key, supporting both legacy service_role and newer secret key env names.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = readPublicAnonKey();

  if (!url || !key) return false;
  if (url.includes("placeholder") || key.includes("placeholder")) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

export function isServiceRoleConfigured(): boolean {
  const serviceKey = getSupabaseServiceRoleKey();
  return (
    isSupabaseConfigured() &&
    Boolean(serviceKey) &&
    !serviceKey!.includes("placeholder")
  );
}

export function getSupabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    anonKey: readPublicAnonKey() || PLACEHOLDER_KEY,
    configured: isSupabaseConfigured(),
  };
}

