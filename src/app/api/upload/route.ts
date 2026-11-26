import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestAuditMeta, assertSameOrigin } from "@/lib/security/csrf";
import { inspectAndSanitizeUpload, buildRandomizedStoragePath } from "@/lib/security/upload";
import { recordAuditLog } from "@/lib/security/audit";

const PRIVATE_BUCKETS = new Set(["kyc-documents", "payment-proofs", "delivery-proofs"]);
const PUBLIC_BUCKETS = new Set(["product-images", "review-images"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

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

  const { ip, userAgent } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("upload", `${ip}:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Upload rate limit reached. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const bucket = String(formData.get("bucket") || "").trim();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Select a valid file to upload." }, { status: 400 });
    }

    if (!PRIVATE_BUCKETS.has(bucket) && !PUBLIC_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid upload bucket." }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File must be non-empty and under 8 MB." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: "Active account required." }, { status: 403 });
    }

    // Role authorization per bucket
    if (bucket === "product-images" && profile.role !== "shop" && profile.role !== "admin") {
      return NextResponse.json({ error: "Seller or admin role required for product images." }, { status: 403 });
    }
    if (bucket === "delivery-proofs" && profile.role !== "transporter" && profile.role !== "admin") {
      return NextResponse.json({ error: "Transporter or admin role required for delivery proofs." }, { status: 403 });
    }
    if (bucket === "kyc-documents" && !["shop", "b2b", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Seller, B2B, or admin role required for KYC uploads." }, { status: 403 });
    }

    const allowPdf = bucket === "kyc-documents" || bucket === "payment-proofs";
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const inspected = inspectAndSanitizeUpload(rawBuffer, allowPdf);
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const storageDb = adminClient || supabase;

    // Ensure private or public bucket exists without forcing public access on sensitive buckets
    if (adminClient) {
      await adminClient.storage
        .createBucket(bucket, { public: PUBLIC_BUCKETS.has(bucket) })
        .catch(() => null);
    }

    const storagePath = buildRandomizedStoragePath(user.id, inspected.data.extension);

    const { error: uploadErr } = await storageDb.storage
      .from(bucket)
      .upload(storagePath, inspected.data.buffer, {
        contentType: inspected.data.mime,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    await recordAuditLog(
      {
        request,
        actorId: user.id,
        actorRole: profile.role,
        action: `storage.upload.${bucket}`,
        entityType: "storage_object",
        entityId: storagePath,
        details: { bucket, mime: inspected.data.mime, size: inspected.data.buffer.length, ip, userAgent },
      },
      storageDb
    );

    if (PUBLIC_BUCKETS.has(bucket)) {
      const { data: pub } = storageDb.storage.from(bucket).getPublicUrl(storagePath);
      return NextResponse.json(
        {
          bucket,
          path: storagePath,
          url: pub?.publicUrl || null,
          mime: inspected.data.mime,
        },
        { status: 201 }
      );
    }

    // Return opaque private storage reference; callers view via /api/storage/signed-url
    return NextResponse.json(
      {
        bucket,
        path: storagePath,
        privateRef: `${bucket}:${storagePath}`,
        mime: inspected.data.mime,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Upload processing failed." },
      { status: 500 }
    );
  }
}
