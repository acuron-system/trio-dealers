import { NextResponse } from "next/server";
import { requireProductActor } from "@/lib/product-server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestAuditMeta, assertSameOrigin } from "@/lib/security/csrf";
import { inspectAndSanitizeUpload, buildRandomizedStoragePath } from "@/lib/security/upload";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("upload", `${ip}:${ctx.userId}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Upload rate limit reached. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Select at least one image file to upload." },
        { status: 400 }
      );
    }

    await ctx.db.storage
      .createBucket("product-images", { public: true })
      .catch(() => null);

    const urls: string[] = [];
    const folder = ctx.shop?.id || `admin-${ctx.userId}`;

    for (const file of files) {
      if (file.size === 0 || file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `${file.name} must be under 5 MB.` },
          { status: 400 }
        );
      }

      const rawBuffer = Buffer.from(await file.arrayBuffer());
      const inspected = inspectAndSanitizeUpload(rawBuffer, false);
      if (!inspected.ok) {
        return NextResponse.json(
          { error: `${file.name}: ${inspected.error}` },
          { status: 400 }
        );
      }

      const filePath = buildRandomizedStoragePath(folder, inspected.data.extension);

      const { error: uploadErr } = await ctx.db.storage
        .from("product-images")
        .upload(filePath, inspected.data.buffer, {
          contentType: inspected.data.mime,
          upsert: false,
        });

      if (uploadErr) {
        return NextResponse.json(
          { error: `Upload failed for ${file.name}: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const { data: pub } = ctx.db.storage
        .from("product-images")
        .getPublicUrl(filePath);
      if (pub?.publicUrl) {
        urls.push(pub.publicUrl);
      }
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to upload product images." },
      { status: 500 }
    );
  }
}
