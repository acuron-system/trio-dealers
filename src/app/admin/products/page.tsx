"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchBrands, fetchCategories, fetchSizeCharts } from "@/lib/db";
import {
  generateProductCsvTemplate,
  getProductDisplayStatus,
} from "@/lib/product-rules";
import {
  Brand,
  Category,
  Product,
  ProductAuditLog,
  Shop,
  SizeChart,
  StockMovement,
} from "@/types/database";
import { formatINR } from "@/lib/utils";
import { ProductFormModal } from "@/components/products/product-form-modal";
import { ProductDeleteModal } from "@/components/products/product-delete-modal";
import { ProductAuditTable } from "@/components/products/product-audit-table";
import { ProductStockTable } from "@/components/products/product-stock-table";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

const STATUS_BADGE_MAP: Record<string, string> = {
  draft: "bg-surface-subtle text-ink-secondary border-edge",
  pending:
    "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/35",
  approved:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/35",
  unpublished: "bg-surface-subtle text-ink-muted border-edge",
  changes_requested:
    "bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/35",
  rejected: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/35",
  archived: "bg-surface-subtle text-ink-muted border-edge",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProductAuditLog[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "stock" | "audit">(
    "catalog"
  );
  const [shopFilter, setShopFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Admin unpublish reason modal
  const [unpublishTarget, setUnpublishTarget] = useState<Product | null>(null);
  const [unpublishReason, setUnpublishReason] = useState("");

  // Bulk CSV modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [bulkShopId, setBulkShopId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);

  const showNotice = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [prodRes, cats, brs, scs, shopsRes, auditRes, stockRes] =
      await Promise.all([
        fetch("/api/products")
          .then((r) => r.json())
          .catch(() => ({ products: [] })),
        fetchCategories(supabase, true),
        fetchBrands(supabase, true),
        fetchSizeCharts(supabase),
        supabase.from("shops").select("*").order("shop_name", { ascending: true }),
        fetch("/api/products/audit")
          .then((r) => r.json())
          .catch(() => ({ logs: [] })),
        fetch("/api/products/stock")
          .then((r) => r.json())
          .catch(() => ({ movements: [] })),
      ]);

    setProducts(prodRes.products || []);
    setCategories(cats);
    setBrands(brs);
    setSizeCharts(scs);
    setShops((shopsRes.data as Shop[]) || []);
    setAuditLogs(auditRes.logs || []);
    setStockMovements(stockRes.movements || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const displayStatus = getProductDisplayStatus(p);
      if (statusFilter !== "all" && displayStatus !== statusFilter) return false;
      if (shopFilter !== "all" && p.shop_id !== shopFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.fabric || ""} ${p.hsn_code || ""} ${
          p.shop?.shop_name || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, statusFilter, shopFilter, searchTerm]);

  const handlePublish = async (p: Product) => {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_publish", is_active: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Unable to publish.");
      return;
    }
    showNotice("success", `"${p.name}" published live.`);
    await loadAll();
  };

  const handleConfirmUnpublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unpublishTarget) return;
    const res = await fetch(`/api/products/${unpublishTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_publish",
        is_active: false,
        reason: unpublishReason.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Unable to unpublish.");
      return;
    }
    setUnpublishTarget(null);
    setUnpublishReason("");
    showNotice("success", `Product unpublished and seller notified.`);
    await loadAll();
  };

  const handleRestore = async (p: Product) => {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore",
        reason: "Restored by Administrator",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Unable to restore product.");
      return;
    }
    showNotice("success", `"${p.name}" restored to Pending Moderation.`);
    await loadAll();
  };

  const handleQuickApprove = async (p: Product) => {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "moderate",
        approval_status: "approved",
        moderation_note: "Approved from Admin Product Manager",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Cannot approve product.");
      return;
    }
    showNotice("success", `"${p.name}" approved and published live.`);
    await loadAll();
  };

  const handleDownloadCsvTemplate = () => {
    const csv = generateProductCsvTemplate(categories[0]?.slug || "silk-sarees");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trio_dealers_admin_product_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) return;
    setImportingCsv(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, shop_id: bulkShopId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setShowCsvModal(false);
      setCsvText("");
      showNotice("success", `Imported ${data.importedCount || 0} products.`);
      await loadAll();
    } catch (err: any) {
      showNotice("error", err.message || "Bulk import failed.");
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
              Master Textile Inventory & Admin Catalog
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              Manage house stock and seller shop products, control visibility, restore archives, and adjust stock across all mills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/moderation"
              className="px-4 py-2.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-gold-400 font-bold text-xs transition"
            >
              Moderation Queue
            </Link>
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="px-4 py-2.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-ink font-bold text-xs transition inline-flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4 text-gold-400" />
              Bulk CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setShowFormModal(true);
              }}
              className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
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

        {/* Section Tabs */}
        <div className="flex items-center gap-2 border-b border-edge pb-2 text-xs font-bold uppercase tracking-wider overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "catalog"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "stock"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Stock & Movements ({stockMovements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Full Audit Log ({auditLogs.length})
          </button>
        </div>

        {activeTab === "catalog" && (
          <div className="space-y-5">
            <div className="luxury-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase">
                {[
                  "all",
                  "approved",
                  "pending",
                  "draft",
                  "changes_requested",
                  "unpublished",
                  "rejected",
                  "archived",
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      statusFilter === st
                        ? "bg-gold-500 text-black"
                        : "bg-surface-subtle border border-edge text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={shopFilter}
                  onChange={(e) => setShopFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-xs text-ink"
                >
                  <option value="all">All Shops / Mills</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name}
                    </option>
                  ))}
                </select>

                <div className="relative sm:w-64">
                  <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search title, shop, HSN..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-input border border-edge text-xs text-ink placeholder:text-ink-muted outline-none focus:border-gold-500"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-10 rounded-3xl luxury-card text-center text-xs text-ink-muted">
                Loading platform product catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 rounded-3xl luxury-card text-center space-y-2 text-xs text-ink-muted">
                <Package className="w-8 h-8 mx-auto text-gold-400" />
                <p>No products matching filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((p) => {
                  const displayStatus = getProductDisplayStatus(p);
                  const totalStock = (p.variants || []).reduce(
                    (s, v) => s + (v.stock_qty || 0),
                    0
                  );
                  const thumb = p.images?.[0]?.url || "/logo.png";

                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-3xl luxury-card hover:border-gold-500/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={thumb}
                          alt={p.name}
                          className="w-20 h-24 rounded-2xl object-cover border border-edge bg-surface-subtle shrink-0"
                        />

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                STATUS_BADGE_MAP[displayStatus] ||
                                STATUS_BADGE_MAP.draft
                              }`}
                            >
                              {displayStatus.replace(/_/g, " ")}
                            </span>
                            <span className="text-[11px] font-semibold text-gold-400">
                              {p.shop?.shop_name || "House Stock"}
                            </span>
                            {p.category && (
                              <span className="text-[11px] text-ink-muted">
                                • {p.category.name}
                              </span>
                            )}
                          </div>

                          <h3 className="font-heading font-bold text-base text-ink">
                            {p.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                            <span className="font-mono font-bold text-ink">
                              {formatINR(p.retail_price)}
                            </span>
                            <span>•</span>
                            <span>{totalStock} units</span>
                            <span>•</span>
                            <span className="font-mono">
                              HSN {p.hsn_code || "N/A"} ({p.gst_rate ?? 5}% GST)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {displayStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleQuickApprove(p)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        )}

                        {displayStatus === "approved" && (
                          <Link
                            href={`/product/${p.slug}`}
                            className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink hover:border-gold-500 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-gold-400" />
                            View
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p);
                            setShowFormModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink hover:border-gold-500 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-gold-400" />
                          Edit
                        </button>

                        {displayStatus === "approved" && (
                          <button
                            type="button"
                            onClick={() => {
                              setUnpublishTarget(p);
                              setUnpublishReason("");
                            }}
                            className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-amber-700 dark:text-amber-400 hover:border-amber-500 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Unpublish
                          </button>
                        )}

                        {displayStatus === "unpublished" && (
                          <button
                            type="button"
                            onClick={() => handlePublish(p)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Publish
                          </button>
                        )}

                        {displayStatus === "archived" ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(p)}
                            className="px-3 py-1.5 rounded-xl bg-blue-500/12 border border-blue-500/35 text-blue-700 dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-600 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "stock" && (
          <ProductStockTable
            movements={stockMovements}
            products={products}
            onStockAdjusted={loadAll}
          />
        )}

        {activeTab === "audit" && (
          <ProductAuditTable logs={auditLogs} showShop={true} />
        )}
      </div>

      {showFormModal && (
        <ProductFormModal
          product={editingProduct}
          isAdmin={true}
          categories={categories}
          brands={brands}
          sizeCharts={sizeCharts}
          shops={shops}
          onClose={() => setShowFormModal(false)}
          onSaved={async (msg) => {
            setShowFormModal(false);
            showNotice("success", msg);
            await loadAll();
          }}
        />
      )}

      {deletingProduct && (
        <ProductDeleteModal
          product={deletingProduct}
          isAdmin={true}
          onClose={() => setDeletingProduct(null)}
          onCompleted={async (msg) => {
            setDeletingProduct(null);
            showNotice("success", msg);
            await loadAll();
          }}
        />
      )}

      {unpublishTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmUnpublish}
            className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-md w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-heading font-bold text-sm text-ink">
                Unpublish Product Reason Required
              </h3>
              <button
                type="button"
                onClick={() => setUnpublishTarget(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-ink-secondary">
              Specify why <strong className="text-ink">{unpublishTarget.name}</strong> is being hidden from buyers. The seller receives an immediate notification.
            </p>
            <textarea
              required
              rows={3}
              value={unpublishReason}
              onChange={(e) => setUnpublishReason(e.target.value)}
              placeholder="e.g. Incorrect HSN tax slab or blurry primary photo"
              className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink outline-none focus:border-gold-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnpublishTarget(null)}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                Confirm Unpublish
              </button>
            </div>
          </form>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-heading font-bold text-base text-ink">
                Admin Bulk CSV Import
              </h3>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <select
                value={bulkShopId}
                onChange={(e) => setBulkShopId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="">Trio Dealers House Stock</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shop_name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-gold-400 font-bold inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Sample CSV
              </button>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV rows here..."
              className="w-full p-3.5 rounded-2xl bg-surface-input border border-edge font-mono text-ink outline-none focus:border-gold-500"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importingCsv || !csvText.trim()}
                onClick={handleBulkImport}
                className="btn-gold-luxury px-5 py-2 rounded-xl uppercase tracking-wider disabled:opacity-50"
              >
                {importingCsv ? "Importing..." : "Run Bulk Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
