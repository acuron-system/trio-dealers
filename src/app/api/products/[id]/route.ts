import { NextResponse } from "next/server";
import {
  cleanupCartItemsForProduct,
  fetchEnrichedProductById,
  getProductHistoryStats,
  notifyAdminsOfSubmission,
  recordProductAuditLog,
  requireProductActor,
  sendNotification,
  syncProductChildren,
} from "@/lib/product-server";
import {
  didLiveContentChange,
  ProductPayloadInput,
  validateProductSubmission,
} from "@/lib/product-rules";
import { ProductApprovalStatus, ProductAuditAction } from "@/types/database";

async function loadAuthorizedProduct(productId: string) {
  const authResult = await requireProductActor();
  if ("error" in authResult) return authResult;
  const { ctx } = authResult;

  const product = await fetchEnrichedProductById(ctx.db, productId);
  if (!product) {
    return {
      error: NextResponse.json({ error: "Product not found." }, { status: 404 }),
    };
  }

  if (!ctx.isAdmin && product.shop?.owner_id !== ctx.userId) {
    return {
      error: NextResponse.json(
        { error: "You can only manage products belonging to your own shop." },
        { status: 403 }
      ),
    };
  }

  return { ctx, product };
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const loaded = await loadAuthorizedProduct(context.params.id);
  if ("error" in loaded) return loaded.error;
  const { ctx, product } = loaded;

  const [historyStats, { data: auditLogs }, { data: statusHistory }] = await Promise.all([
    getProductHistoryStats(ctx.db, product.id),
    ctx.db
      .from("product_audit_logs")
      .select("*, actor:profiles(id, full_name, role)")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(20),
    ctx.db
      .from("product_status_history")
      .select("*, actor:profiles(id, full_name, role)")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    product,
    historyStats,
    auditLogs: auditLogs || [],
    statusHistory: statusHistory || [],
  });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const loaded = await loadAuthorizedProduct(context.params.id);
  if ("error" in loaded) return loaded.error;
  const { ctx, product } = loaded;

  try {
    const body = await request.json();
    const action = body.action || "edit";
    const previousStatus = product.is_archived
      ? "archived"
      : product.approval_status === "approved" && !product.is_active
      ? "unpublished"
      : product.approval_status || "pending";

    // 1. ADMIN MODERATION ACTION
    if (action === "moderate") {
      if (!ctx.isAdmin) {
        return NextResponse.json(
          { error: "Only administrators can approve, reject, or request changes." },
          { status: 403 }
        );
      }

      const nextStatus = body.approval_status as ProductApprovalStatus;
      const note = String(body.moderation_note || body.reason || "").trim();

      if (!["approved", "rejected", "changes_requested"].includes(nextStatus)) {
        return NextResponse.json({ error: "Invalid moderation decision." }, { status: 400 });
      }

      if ((nextStatus === "rejected" || nextStatus === "changes_requested") && !note) {
        return NextResponse.json(
          { error: "Please provide a clear reason/note for the seller shop." },
          { status: 400 }
        );
      }

      if (nextStatus === "approved") {
        const validation = validateProductSubmission(
          {
            name: product.name,
            category_id: product.category_id,
            fabric: product.fabric,
            description: product.description,
            care_instructions: product.care_instructions,
            video_url: product.video_url,
            hsn_code: product.hsn_code,
            gst_rate: Number(product.gst_rate || 0),
            mrp: Number(product.mrp || 0),
            retail_price: Number(product.retail_price || 0),
            b2b_moq: Number(product.b2b_moq || 1),
            sell_retail: product.sell_retail ?? true,
            sell_b2b: product.sell_b2b ?? true,
            images: (product.images || []).map((i) => i.url),
            variants: (product.variants || []).map((v) => ({
              id: v.id,
              size: v.size,
              color: v.color,
              sku: v.sku,
              stock_qty: v.stock_qty,
            })),
            price_slabs: (product.price_slabs || []).map((s) => ({
              id: s.id,
              min_qty: s.min_qty,
              unit_price: s.unit_price,
            })),
          },
          "approved"
        );

        if (!validation.valid) {
          return NextResponse.json(
            { error: `Cannot approve: ${validation.errors.join(" ")}`, errors: validation.errors },
            { status: 400 }
          );
        }
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await ctx.db
        .from("products")
        .update({
          approval_status: nextStatus,
          moderation_note: note || null,
          is_active: nextStatus === "approved" ? true : product.is_active,
          approved_at: nextStatus === "approved" ? nowIso : product.approved_at || null,
          approved_by: nextStatus === "approved" ? ctx.userId : product.approved_by || null,
          updated_at: nowIso,
        })
        .eq("id", product.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      if (nextStatus !== "approved") {
        await cleanupCartItemsForProduct(ctx.db, product.id);
      }

      const auditAction: ProductAuditAction =
        nextStatus === "approved"
          ? "approved"
          : nextStatus === "changes_requested"
          ? "changes_requested"
          : "rejected";

      await recordProductAuditLog(ctx.db, {
        productId: product.id,
        productName: product.name,
        shopId: product.shop_id,
        actorId: ctx.userId,
        actorRole: ctx.profile.role,
        action: auditAction,
        previousStatus,
        newStatus: nextStatus,
        reason: note || null,
      });

      if (product.shop?.owner_id) {
        const statusTitle =
          nextStatus === "approved"
            ? "Product Listing Approved"
            : nextStatus === "changes_requested"
            ? "Changes Requested on Product"
            : "Product Listing Rejected";
        const msg =
          nextStatus === "approved"
            ? `Your product "${product.name}" is now live on Trio Dealers.`
            : `"${product.name}" requires attention (${nextStatus.replace("_", " ")}): ${note}`;

        await sendNotification(ctx.db, {
          userId: product.shop.owner_id,
          title: statusTitle,
          message: msg,
          linkUrl: "/seller/products",
        });
      }

      const updated = await fetchEnrichedProductById(ctx.db, product.id);
      return NextResponse.json({ product: updated });
    }

    // 2. UNPUBLISH / PUBLISH TOGGLE
    if (action === "toggle_publish") {
      if (product.is_archived || product.deleted_at) {
        return NextResponse.json(
          { error: "Archived products cannot be published directly." },
          { status: 400 }
        );
      }

      const nextActive = typeof body.is_active === "boolean" ? body.is_active : !product.is_active;
      const reason = String(body.reason || "").trim();

      if (ctx.isAdmin && !nextActive && !reason) {
        return NextResponse.json(
          { error: "Administrators must provide a reason when unpublishing a product." },
          { status: 400 }
        );
      }

      if (nextActive && product.approval_status !== "approved") {
        return NextResponse.json(
          { error: "Only admin-approved products can be published live." },
          { status: 400 }
        );
      }

      const { error: toggleErr } = await ctx.db
        .from("products")
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (toggleErr) {
        return NextResponse.json({ error: toggleErr.message }, { status: 400 });
      }

      if (!nextActive) {
        await cleanupCartItemsForProduct(ctx.db, product.id);
      }

      await recordProductAuditLog(ctx.db, {
        productId: product.id,
        productName: product.name,
        shopId: product.shop_id,
        actorId: ctx.userId,
        actorRole: ctx.profile.role,
        action: nextActive ? "published" : "unpublished",
        previousStatus,
        newStatus: nextActive ? "approved" : "unpublished",
        reason: reason || null,
      });

      if (ctx.isAdmin && !nextActive && product.shop?.owner_id) {
        await sendNotification(ctx.db, {
          userId: product.shop.owner_id,
          title: "Product Unpublished by Admin",
          message: `"${product.name}" was unpublished by Admin. Reason: ${reason}`,
          linkUrl: "/seller/products",
        });
      }

      const updated = await fetchEnrichedProductById(ctx.db, product.id);
      return NextResponse.json({ product: updated });
    }

    // 3. SOFT DELETE / ARCHIVE (or RESTORE by Admin)
    if (action === "archive") {
      const reason = String(body.reason || "").trim();
      if (ctx.isAdmin && !reason) {
        return NextResponse.json(
          { error: "Administrators must provide a reason to archive a product." },
          { status: 400 }
        );
      }

      const archiveNote = reason || "Archived by seller shop (preserving order & GST history).";

      const { error: archErr } = await ctx.db
        .from("products")
        .update({
          is_archived: true,
          is_active: false,
          archived_reason: archiveNote,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (archErr) {
        return NextResponse.json({ error: archErr.message }, { status: 400 });
      }

      await cleanupCartItemsForProduct(ctx.db, product.id);

      await recordProductAuditLog(ctx.db, {
        productId: product.id,
        productName: product.name,
        shopId: product.shop_id,
        actorId: ctx.userId,
        actorRole: ctx.profile.role,
        action: "archived",
        previousStatus,
        newStatus: "archived",
        reason: archiveNote,
      });

      if (ctx.isAdmin && product.shop?.owner_id) {
        await sendNotification(ctx.db, {
          userId: product.shop.owner_id,
          title: "Product Archived by Admin",
          message: `"${product.name}" was archived by Admin. Reason: ${archiveNote}`,
          linkUrl: "/seller/products",
        });
      }

      const updated = await fetchEnrichedProductById(ctx.db, product.id);
      return NextResponse.json({ product: updated });
    }

    if (action === "restore") {
      if (!ctx.isAdmin) {
        return NextResponse.json({ error: "Only administrators can restore archived products." }, { status: 403 });
      }

      const { error: resErr } = await ctx.db
        .from("products")
        .update({
          is_archived: false,
          deleted_at: null,
          archived_reason: null,
          approval_status: "pending",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (resErr) {
        return NextResponse.json({ error: resErr.message }, { status: 400 });
      }

      await recordProductAuditLog(ctx.db, {
        productId: product.id,
        productName: product.name,
        shopId: product.shop_id,
        actorId: ctx.userId,
        actorRole: ctx.profile.role,
        action: "restored",
        previousStatus,
        newStatus: "pending",
        reason: String(body.reason || "").trim() || "Restored by Admin",
      });

      const updated = await fetchEnrichedProductById(ctx.db, product.id);
      return NextResponse.json({ product: updated });
    }

    // 4. EDIT PRODUCT (Applies live price/stock edits immediately; re-queues name/description/image edits on live listings)
    const submitMode = body.submitMode as "draft" | "submit" | "keep" | undefined;
    const normalizedInput: ProductPayloadInput = {
      name: String(body.name ?? product.name).trim(),
      category_id: body.category_id !== undefined ? body.category_id : product.category_id,
      brand_id: body.brand_id !== undefined ? body.brand_id : product.brand_id,
      size_chart_id: body.size_chart_id !== undefined ? body.size_chart_id : product.size_chart_id,
      fabric: String(body.fabric ?? product.fabric ?? "").trim(),
      fit: String(body.fit ?? product.fit ?? "").trim(),
      pattern: String(body.pattern ?? product.pattern ?? "").trim(),
      occasion: String(body.occasion ?? product.occasion ?? "").trim(),
      audience: body.audience !== undefined ? body.audience : product.audience || "unisex",
      description: String(body.description ?? product.description ?? "").trim(),
      care_instructions: String(body.care_instructions ?? product.care_instructions ?? "").trim(),
      video_url: String(body.video_url ?? product.video_url ?? "").trim(),
      hsn_code: String(body.hsn_code ?? product.hsn_code ?? "").trim(),
      gst_rate: Number(body.gst_rate ?? product.gst_rate ?? 0),
      mrp: Number(body.mrp ?? product.mrp ?? 0),
      retail_price: Number(body.retail_price ?? product.retail_price ?? 0),
      b2b_moq: Number(body.b2b_moq ?? product.b2b_moq ?? 10),
      sell_retail: body.sell_retail !== undefined ? Boolean(body.sell_retail) : product.sell_retail ?? true,
      sell_b2b: body.sell_b2b !== undefined ? Boolean(body.sell_b2b) : product.sell_b2b ?? true,
      images: Array.isArray(body.images)
        ? body.images.map(String).filter((u: string) => u.trim())
        : (product.images || []).map((i) => i.url),
      image_metadata: Array.isArray(body.image_metadata) ? body.image_metadata : undefined,
      variants: Array.isArray(body.variants)
        ? body.variants
        : (product.variants || []).map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            color_hex: v.color_hex,
            sku: v.sku,
            stock_qty: v.stock_qty,
            low_stock_threshold: v.low_stock_threshold,
            is_active: v.is_active,
          })),
      price_slabs: Array.isArray(body.price_slabs)
        ? body.price_slabs
        : (product.price_slabs || []).map((s) => ({
            id: s.id,
            min_qty: s.min_qty,
            unit_price: s.unit_price,
          })),
    };

    let nextStatus: ProductApprovalStatus = product.approval_status || "pending";
    let nextActive = product.is_active;
    let moderationNote = product.moderation_note || null;
    let triggeredReReview = false;

    if (submitMode === "draft" && (ctx.isAdmin || product.approval_status !== "approved")) {
      nextStatus = "draft";
      nextActive = false;
    } else if (submitMode === "submit") {
      if (ctx.isAdmin && body.approveImmediately) {
        nextStatus = "approved";
        nextActive = true;
        moderationNote = null;
      } else if (product.approval_status === "approved") {
        // Check if non-admin changed moderated live fields
        const contentChanged = didLiveContentChange(product, {
          name: normalizedInput.name,
          description: normalizedInput.description,
          images: normalizedInput.images,
        });
        if (!ctx.isAdmin && contentChanged) {
          nextStatus = "pending";
          moderationNote = "Re-submitted for admin review after name, description, or image edits.";
          triggeredReReview = true;
        }
      } else {
        nextStatus = ctx.isAdmin ? product.approval_status || "pending" : "pending";
        nextActive = true;
        moderationNote = null;
      }
    } else if (!ctx.isAdmin && product.approval_status === "approved") {
      const contentChanged = didLiveContentChange(product, {
        name: normalizedInput.name,
        description: normalizedInput.description,
        images: normalizedInput.images,
      });
      if (contentChanged) {
        nextStatus = "pending";
        moderationNote = "Re-submitted for admin review after name, description, or image edits.";
        triggeredReReview = true;
      }
    }

    const validation = validateProductSubmission(normalizedInput, nextStatus);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: editErr } = await ctx.db
      .from("products")
      .update({
        category_id: normalizedInput.category_id || null,
        brand_id: normalizedInput.brand_id || null,
        size_chart_id: normalizedInput.size_chart_id || null,
        name: normalizedInput.name,
        description: normalizedInput.description || null,
        care_instructions: normalizedInput.care_instructions || null,
        video_url: normalizedInput.video_url || null,
        fabric: normalizedInput.fabric || null,
        fit: normalizedInput.fit || null,
        pattern: normalizedInput.pattern || null,
        occasion: normalizedInput.occasion || null,
        audience: normalizedInput.audience || "unisex",
        hsn_code: normalizedInput.hsn_code || null,
        gst_rate: normalizedInput.gst_rate,
        mrp: normalizedInput.mrp,
        retail_price: normalizedInput.retail_price,
        b2b_moq: normalizedInput.b2b_moq,
        sell_retail: normalizedInput.sell_retail,
        sell_b2b: normalizedInput.sell_b2b,
        approval_status: nextStatus,
        moderation_note: moderationNote,
        is_active: nextActive,
        submitted_at: nextStatus === "pending" && previousStatus !== "pending" ? nowIso : product.submitted_at || null,
        approved_at: nextStatus === "approved" && previousStatus !== "approved" ? nowIso : product.approved_at || null,
        approved_by: nextStatus === "approved" && previousStatus !== "approved" ? ctx.userId : product.approved_by || null,
        updated_at: nowIso,
      })
      .eq("id", product.id);

    if (editErr) {
      return NextResponse.json({ error: editErr.message }, { status: 400 });
    }

    await syncProductChildren(ctx.db, product.id, normalizedInput.name, normalizedInput, ctx.userId, "manual_adjust");

    if (triggeredReReview) {
      await cleanupCartItemsForProduct(ctx.db, product.id);
      await notifyAdminsOfSubmission(ctx.db, {
        productName: normalizedInput.name,
        shopName: product.shop?.shop_name || "Seller Shop",
        isResubmission: true,
      });
    } else if (previousStatus !== "pending" && nextStatus === "pending") {
      await notifyAdminsOfSubmission(ctx.db, {
        productName: normalizedInput.name,
        shopName: product.shop?.shop_name || "Seller Shop",
      });
    }

    await recordProductAuditLog(ctx.db, {
      productId: product.id,
      productName: normalizedInput.name,
      shopId: product.shop_id,
      actorId: ctx.userId,
      actorRole: ctx.profile.role,
      action: triggeredReReview
        ? "edited_resubmitted"
        : previousStatus !== "pending" && nextStatus === "pending"
        ? "submitted"
        : "edited",
      previousStatus,
      newStatus: nextStatus,
      reason: triggeredReReview ? "Name, description, or images changed on live product." : null,
    });

    const updated = await fetchEnrichedProductById(ctx.db, product.id);
    return NextResponse.json({ product: updated, requeuedForReview: triggeredReReview });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update product." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const loaded = await loadAuthorizedProduct(context.params.id);
  if ("error" in loaded) return loaded.error;
  const { ctx, product } = loaded;

  let reason = "";
  let mode: "archive" | "permanent" = "permanent";

  try {
    const url = new URL(request.url);
    reason = (url.searchParams.get("reason") || "").trim();
    const qpMode = url.searchParams.get("mode");
    if (qpMode === "archive" || qpMode === "permanent") mode = qpMode;

    const text = await request.text();
    if (text) {
      const body = JSON.parse(text);
      if (body.reason) reason = String(body.reason).trim();
      if (body.mode === "archive" || body.mode === "permanent") mode = body.mode;
    }
  } catch {
    // Allow empty body for shops deleting unreferenced products
  }

  if (ctx.isAdmin && !reason) {
    return NextResponse.json(
      { error: "Administrators must enter a required reason when deleting or archiving a product." },
      { status: 400 }
    );
  }

  const stats = await getProductHistoryStats(ctx.db, product.id);
  const previousStatus = product.is_archived ? "archived" : product.approval_status || "pending";

  // Non-admin shops CANNOT permanently delete ordered or reviewed products
  if (!ctx.isAdmin && stats.hasHistory) {
    if (mode !== "archive") {
      return NextResponse.json(
        {
          error:
            "This product has existing orders, returns, or reviews and cannot be permanently deleted. Archive it instead so GST invoices and order history stay intact.",
          requiresArchive: true,
          historyStats: stats,
        },
        { status: 409 }
      );
    }

    const archiveNote = reason || "Archived by shop (product has order/review history).";
    const { error: archErr } = await ctx.db
      .from("products")
      .update({
        is_archived: true,
        is_active: false,
        archived_reason: archiveNote,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (archErr) {
      return NextResponse.json({ error: archErr.message }, { status: 400 });
    }

    await cleanupCartItemsForProduct(ctx.db, product.id);

    await recordProductAuditLog(ctx.db, {
      productId: product.id,
      productName: product.name,
      shopId: product.shop_id,
      actorId: ctx.userId,
      actorRole: ctx.profile.role,
      action: "archived",
      previousStatus,
      newStatus: "archived",
      reason: archiveNote,
    });

    return NextResponse.json({ archived: true, deleted: false });
  }

  if (mode === "archive") {
    const archiveNote = reason || "Archived to preserve records.";
    const { error: archErr } = await ctx.db
      .from("products")
      .update({
        is_archived: true,
        is_active: false,
        archived_reason: archiveNote,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (archErr) {
      return NextResponse.json({ error: archErr.message }, { status: 400 });
    }

    await cleanupCartItemsForProduct(ctx.db, product.id);

    await recordProductAuditLog(ctx.db, {
      productId: product.id,
      productName: product.name,
      shopId: product.shop_id,
      actorId: ctx.userId,
      actorRole: ctx.profile.role,
      action: "archived",
      previousStatus,
      newStatus: "archived",
      reason: archiveNote,
    });

    if (ctx.isAdmin && product.shop?.owner_id) {
      await sendNotification(ctx.db, {
        userId: product.shop.owner_id,
        title: "Product Archived by Admin",
        message: `"${product.name}" was archived by Admin. Reason: ${archiveNote}`,
        linkUrl: "/seller/products",
      });
    }

    return NextResponse.json({ archived: true, deleted: false });
  }

  // Permanent deletion
  await cleanupCartItemsForProduct(ctx.db, product.id);

  // Record audit log BEFORE permanent delete (product_id set null cleanly on delete)
  await recordProductAuditLog(ctx.db, {
    productId: product.id,
    productName: product.name,
    shopId: product.shop_id,
    actorId: ctx.userId,
    actorRole: ctx.profile.role,
    action: "deleted",
    previousStatus,
    newStatus: "deleted",
    reason: reason || "Permanently deleted by shop (no orders/reviews).",
    metadata: {
      hadOrders: stats.orderItemsCount > 0,
      hadReviews: stats.reviewsCount > 0,
    },
  });

  const { error: delErr } = await ctx.db.from("products").delete().eq("id", product.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  if (ctx.isAdmin && product.shop?.owner_id) {
    await sendNotification(ctx.db, {
      userId: product.shop.owner_id,
      title: "Product Permanently Deleted by Admin",
      message: `"${product.name}" was permanently removed by Admin. Reason: ${reason}`,
      linkUrl: "/seller/products",
    });
  }

  return NextResponse.json({ deleted: true, archived: false });
}

