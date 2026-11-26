import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const PRIVATE_BUCKETS = new Set(["kyc-documents", "payment-proofs", "delivery-proofs"]);

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Storage backend not configured." }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = (searchParams.get("bucket") || "").trim();
  const rawPath = (searchParams.get("path") || "").trim();

  if (!PRIVATE_BUCKETS.has(bucket) || !rawPath || rawPath.includes("..")) {
    return NextResponse.json({ error: "Invalid private document reference." }, { status: 400 });
  }

  const cleanPath = rawPath.replace(/^\/+/, "");
  const ownerFolder = cleanPath.split("/")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Account not active." }, { status: 403 });
  }

  let authorized = profile.role === "admin" || ownerFolder === user.id;

  // Also allow shops to view KYC docs stored under their shop ID
  if (!authorized && bucket === "kyc-documents" && profile.role === "shop") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (shop && shop.id === ownerFolder) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden: insufficient document permissions." }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const storageDb = adminClient || supabase;

  const { data, error } = await storageDb.storage
    .from(bucket)
    .createSignedUrl(cleanPath, 120);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Unable to issue signed document link." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    expiresInSeconds: 120,
  });
}

