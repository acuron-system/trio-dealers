import { NextResponse } from "next/server";
import {
  fetchEnrichedProductById,
  generateUniqueSlug,
  notifyAdminsOfSubmission,
  recordProductAuditLog,
  requireProductActor,
  resolveShopIdForAdmin,
  syncProductChildren,
} from "@/lib/product-server";
import { parseBulkProductCsv } from "@/lib/product-rules";

export async function POST(request: Request) {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult.error;
  const { ctx } = authResult;

  try {
    const body = await request.json();
    const csvText = String(body.csvText || "");
    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV content is empty." }, { status: 400 });
    }

    let targetShop = ctx.shop;
    if (ctx.isAdmin) {
      const resolved = await resolveShopIdForAdmin(ctx.db, ctx.userId, body.shop_id);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      targetShop = resolved.shop;
    }

    if (!targetShop) {
      return NextResponse.json({ error: "Target shop is required for bulk upload." }, { status: 400 });
    }

    const { rows, parseErrors } = parseBulkProductCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: parseErrors[0] || "No valid rows found in CSV.",
          errors: parseErrors,
        },
        { status: 400 }
      );
    }

    const { data: categories } = await ctx.db.from("categories").select("id, slug");
    const catBySlug = new Map(
      (categories || []).map((c: any) => [String(c.slug).toLowerCase(), c.id])
    );

    const createdProducts = [];
    const rowErrors = [...parseErrors];

    for (const row of rows) {
      const categoryId = catBySlug.get(row.categorySlug) || (categories?.[0]?.id ?? null);
      const uniqueSlug = await generateUniqueSlug(ctx.db, row.payload.name);

      // Every bulk CSV row always goes to "pending" for admin approval
      const nowIso = new Date().toISOString();
      const { data: created, error: insErr } = await ctx.db
        .from("products")
        .insert({
          shop_id: targetShop.id,
          category_id: categoryId,
          name: row.payload.name,
          slug: uniqueSlug,
          description: row.payload.description || null,
          care_instructions: row.payload.care_instructions || null,
          video_url: row.payload.video_url || null,
          fabric: row.payload.fabric || null,
          fit: row.payload.fit || null,
          pattern: row.payload.pattern || null,
          occasion: row.payload.occasion || null,
          audience: row.payload.audience || "unisex",
          hsn_code: row.payload.hsn_code || null,
          gst_rate: row.payload.gst_rate || 5,
          mrp: row.payload.mrp,
          retail_price: row.payload.retail_price,
          b2b_moq: row.payload.b2b_moq,
          sell_retail: row.payload.sell_retail,
          sell_b2b: row.payload.sell_b2b,
          approval_status: "pending",
          is_active: true,
          is_archived: false,
          submitted_at: nowIso,
          created_by: ctx.userId,
        })
        .select("id")
        .single();

      if (insErr || !created) {
        rowErrors.push(`Row ${row.rowNumber} (${row.payload.name}): ${insErr?.message || "Insert failed"}`);
        continue;
      }

      await syncProductChildren(ctx.db, created.id, row.payload.name, row.payload, ctx.userId, "import");
      await recordProductAuditLog(ctx.db, {
        productId: created.id,
        productName: row.payload.name,
        shopId: targetShop.id,
        actorId: ctx.userId,
        actorRole: ctx.profile.role,
        action: "bulk_imported",
        previousStatus: null,
        newStatus: "pending",
        reason: `CSV Bulk Import row #${row.rowNumber}`,
      });

      const enriched = await fetchEnrichedProductById(ctx.db, created.id);
      if (enriched) createdProducts.push(enriched);
    }

    if (createdProducts.length > 0) {
      await notifyAdminsOfSubmission(ctx.db, {
        productName: `${createdProducts.length} bulk CSV products`,
        shopName: targetShop.shop_name,
      });
    }

    return NextResponse.json(
      {
        createdCount: createdProducts.length,
        errorCount: rowErrors.length,
        errors: rowErrors,
        products: createdProducts,
      },
      { status: createdProducts.length > 0 ? 201 : 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process bulk CSV import." },
      { status: 400 }
    );
  }
}

