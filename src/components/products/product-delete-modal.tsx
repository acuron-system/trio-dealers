"use client";

import React, { useEffect, useState } from "react";
import { Product } from "@/types/database";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";

interface ProductDeleteModalProps {
  product: Product;
  isAdmin: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

interface HistoryStats {
  orderItemsCount: number;
  reviewsCount: number;
  hasHistory: boolean;
}

export function ProductDeleteModal({
  product,
  isAdmin,
  onClose,
  onCompleted,
}: ProductDeleteModalProps) {
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [mode, setMode] = useState<"archive" | "permanent">("archive");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/products/${product.id}`);
        const data = await res.json();
        if (res.ok && data.historyStats) {
          setStats(data.historyStats);
          if (!data.historyStats.hasHistory && !isAdmin) {
            setMode("permanent");
          } else {
            setMode("archive");
          }
        }
      } catch {
        // fallback safely to archive mode
      } finally {
        setLoadingStats(false);
      }
    }
    loadStats();
  }, [product.id, isAdmin]);

  const permanentAllowed = isAdmin || !stats?.hasHistory;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAdmin && !reason.trim()) {
      setError(
        "Administrators must enter a required reason when archiving or deleting a listing."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/products/${product.id}?mode=${mode}&reason=${encodeURIComponent(
          reason.trim()
        )}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, reason: reason.trim() }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresArchive) {
          setMode("archive");
        }
        throw new Error(data.error || "Action failed.");
      }

      onCompleted(
        data.archived
          ? `"${product.name}" archived to preserve GST and order records.`
          : `"${product.name}" permanently deleted.`
      );
    } catch (err: any) {
      setError(err.message || "Unable to complete action.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between border-b border-edge pb-3">
          <div>
            <h3 className="text-base font-heading font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Remove or Archive Listing
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">{product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingStats ? (
          <p className="text-xs text-ink-muted py-4">
            Checking order history and verified reviews...
          </p>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4 text-xs">
            {stats?.hasHistory && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold">
                  Protected Order / Review History Detected
                </p>
                <p className="text-[11px]">
                  This SKU appears in {stats.orderItemsCount} order item(s) and{" "}
                  {stats.reviewsCount} verified review(s). Archiving keeps GST invoices intact.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2.5">
              <label
                className={`block p-3.5 rounded-2xl border cursor-pointer transition ${
                  mode === "archive"
                    ? "border-gold-500 bg-gold-500/10"
                    : "border-edge bg-surface-subtle"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="archive"
                    checked={mode === "archive"}
                    onChange={() => setMode("archive")}
                    className="mt-0.5 accent-gold-500"
                  />
                  <div>
                    <p className="font-bold text-ink flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5 text-gold-400" />
                      Soft Archive (Recommended)
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      Hides product from buyers while keeping invoice & order history searchable.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 rounded-2xl border transition ${
                  !permanentAllowed
                    ? "opacity-50 cursor-not-allowed border-edge bg-surface-subtle"
                    : mode === "permanent"
                    ? "border-red-500 bg-red-500/10 cursor-pointer"
                    : "border-edge bg-surface-subtle cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="permanent"
                    disabled={!permanentAllowed}
                    checked={mode === "permanent"}
                    onChange={() => setMode("permanent")}
                    className="mt-0.5 accent-red-600"
                  />
                  <div>
                    <p className="font-bold text-ink flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      Permanent Delete
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      {!permanentAllowed
                        ? "Disabled for seller accounts once orders or reviews exist."
                        : "Permanently erases product variants, slabs, and media."}
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-ink-secondary">
                Reason / Audit Note {isAdmin ? "*" : "(Optional)"}
              </label>
              <textarea
                rows={2}
                required={isAdmin}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Discontinued seasonal weave or duplicate SKU"
                className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink outline-none focus:border-gold-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl font-bold text-white transition disabled:opacity-50 ${
                  mode === "permanent"
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {submitting
                  ? "Processing..."
                  : mode === "permanent"
                  ? "Confirm Delete"
                  : "Confirm Archive"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
