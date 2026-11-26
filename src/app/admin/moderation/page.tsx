"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Product } from "@/types/database";
import { formatDateTime, formatINR } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareWarning,
  Store,
  XCircle,
} from "lucide-react";

export default function AdminModerationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<
    "pending" | "changes_requested" | "rejected" | "all"
  >("pending");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showNotice = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts((data.products as Product[]) || []);
    } catch {
      showNotice("error", "Unable to fetch moderation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const queueItems = products.filter((p) => {
    if (p.is_archived || p.deleted_at) return false;
    if (queueFilter === "all") {
      return ["pending", "changes_requested", "rejected"].includes(
        p.approval_status || ""
      );
    }
    return p.approval_status === queueFilter;
  });

  const handleModeration = async (
    product: Product,
    decision: "approved" | "changes_requested" | "rejected"
  ) => {
    const note = (notesById[product.id] || "").trim();
    if (
      (decision === "changes_requested" || decision === "rejected") &&
      !note
    ) {
      showNotice(
        "error",
        "Enter clear feedback/reason before rejecting or requesting changes."
      );
      return;
    }

    setSubmittingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "moderate",
          approval_status: decision,
          moderation_note: note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Moderation failed.");
      }

      showNotice(
        "success",
        `"${product.name}" marked as ${decision.replace("_", " ").toUpperCase()}.`
      );
      await loadQueue();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to moderate product.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ClipboardCheck className="w-3.5 h-3.5" /> Quality & Tax Compliance Review
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Product Approval & Moderation Queue
          </h1>
          <p className="text-xs text-ink-secondary">
            Verify HSN classification, GST slabs, imagery quality, and wholesale terms before seller listings go live.
          </p>
        </div>

        {toast && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-800 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/35 text-red-700 dark:text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
          {(["pending", "changes_requested", "rejected", "all"] as const).map(
            (tab) => {
              const count = products.filter((p) => {
                if (p.is_archived || p.deleted_at) return false;
                if (tab === "all")
                  return ["pending", "changes_requested", "rejected"].includes(
                    p.approval_status || ""
                  );
                return p.approval_status === tab;
              }).length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setQueueFilter(tab)}
                  className={`px-4 py-2 rounded-xl transition ${
                    queueFilter === tab
                      ? "bg-gold-500 text-black shadow-gold"
                      : "bg-surface border border-edge text-ink-secondary hover:text-ink"
                  }`}
                >
                  {tab.replace(/_/g, " ")} ({count})
                </button>
              );
            }
          )}
        </div>

        {loading ? (
          <div className="p-10 rounded-3xl luxury-card text-center text-xs text-ink-muted">
            Loading moderation queue...
          </div>
        ) : queueItems.length === 0 ? (
          <div className="p-12 rounded-3xl luxury-card text-center space-y-2 text-xs text-ink-muted">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-ink">Queue is clear!</p>
            <p>No listings awaiting moderation under this filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {queueItems.map((p) => (
              <div
                key={p.id}
                className="p-6 rounded-3xl luxury-card border border-gold-500/25 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-lg font-heading font-bold text-ink">
                        {p.name}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/35">
                        {p.approval_status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-gold-400 font-semibold">
                        <Store className="w-3.5 h-3.5" />
                        {p.shop?.shop_name || "House Stock"}
                      </span>
                      <span>•</span>
                      <span>{p.category?.name || "Uncategorized"}</span>
                      {p.submitted_at && (
                        <>
                          <span>•</span>
                          <span>Submitted {formatDateTime(p.submitted_at)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    <p className="font-mono font-bold text-lg text-ink">
                      {formatINR(p.retail_price)}
                    </p>
                    <p className="font-mono text-ink-muted">
                      MRP {formatINR(p.mrp || p.retail_price)} • HSN{" "}
                      {p.hsn_code || "MISSING"} ({p.gst_rate ?? 0}%)
                    </p>
                  </div>
                </div>

                {/* Inspection Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                  <div className="lg:col-span-5 grid grid-cols-3 gap-2">
                    {(p.images || []).map((img, i) => (
                      <div
                        key={img.id || i}
                        className="aspect-square rounded-2xl overflow-hidden border border-edge bg-surface-subtle"
                      >
                        <img
                          src={img.url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    <p className="text-ink-secondary leading-relaxed">
                      {p.description || "No description provided."}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-surface-subtle border border-edge">
                        <span className="text-[10px] text-ink-muted block">
                          Fabric
                        </span>
                        <span className="font-semibold text-ink">
                          {p.fabric || "N/A"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-subtle border border-edge">
                        <span className="text-[10px] text-ink-muted block">
                          Variants
                        </span>
                        <span className="font-semibold text-ink">
                          {p.variants?.length || 0} SKUs
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-subtle border border-edge">
                        <span className="text-[10px] text-ink-muted block">
                          Wholesale Slabs
                        </span>
                        <span className="font-semibold text-ink">
                          {p.sell_b2b
                            ? `${p.price_slabs?.length || 0} tiers (MOQ ${
                                p.b2b_moq || 1
                              })`
                            : "Retail Only"}
                        </span>
                      </div>
                    </div>

                    {p.moderation_note && (
                      <div className="p-3 rounded-xl bg-surface-subtle border border-edge text-ink-secondary">
                        <strong>Previous Note:</strong> {p.moderation_note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reviewer Note & Decision Bar */}
                <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Reviewer note / feedback (required if rejecting or requesting changes)..."
                    value={notesById[p.id] || ""}
                    onChange={(e) =>
                      setNotesById((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    className="w-full p-3 rounded-xl bg-surface-input border border-edge text-xs text-ink outline-none focus:border-gold-500"
                  />

                  <div className="flex flex-wrap justify-end gap-2.5 text-xs">
                    <button
                      type="button"
                      disabled={submittingId === p.id}
                      onClick={() => handleModeration(p, "rejected")}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={submittingId === p.id}
                      onClick={() => handleModeration(p, "changes_requested")}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <MessageSquareWarning className="w-4 h-4" />
                      Request Changes
                    </button>

                    <button
                      type="button"
                      disabled={submittingId === p.id}
                      onClick={() => handleModeration(p, "approved")}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Publish Live
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
