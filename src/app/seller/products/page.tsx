"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchBrands,
  fetchCategories,
  fetchSizeCharts,
} from "@/lib/db";
import {
  generateProductCsvTemplate,
  getProductDisplayStatus,
} from "@/lib/product-rules";
import {
  Brand,
  Category,
  Product,
  ProductAuditLog,
  ProductStatusHistory,
  SizeChart,
  StockMovement,
} from "@/types/database";
import { formatDateTime, formatINR } from "@/lib/utils";
import { ProductFormModal } from "@/components/products/product-form-modal";
import { ProductDeleteModal } from "@/components/products/product-delete-modal";
import { ProductAuditTable } from "@/components/products/product-audit-table";
import { ProductStockTable } from "@/components/products/product-stock-table";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  EyeOff,
  History,
  Package,
  Plus,
  Search,
  Store,
  Trash2,
  UploadCloud,
  X,
  Copy,
} from "lucide-react";

const STATUS_BADGE_MAP: Record<string, string> = {
  draft: "bg-surface-subtle text-ink-secondary border-edge",
  pending:
    "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/35",
  approved:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/35",
  unpublished:
    "bg-surface-subtle text-ink-muted border-edge",
  changes_requested:
    "bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/35",
  rejected: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/35",
  archived: "bg-surface-subtle text-ink-muted border-edge",
};

export default function SellerProductsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const shop = user?.shop;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProductAuditLog[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "stock" | "audit">(
    "catalog"
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Bulk CSV modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);

  // History modal
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [statusHistory, setStatusHistory] = useState<ProductStatusHistory[]>(
    []
  );

  const showNotice = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadWorkspace = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [prodRes, cats, brs, scs, auditRes, stockRes] = await Promise.all([
      fetch("/api/products").then((r) => r.json()).catch(() => ({ products: [] })),
      fetchCategories(supabase),
      fetchBrands(supabase),
      fetchSizeCharts(supabase),
      fetch("/api/products/audit").then((r) => r.json()).catch(() => ({ logs: [] })),
      fetch("/api/products/stock")
        .then((r) => r.json())
        .catch(() => ({ movements: [] })),
    ]);

    setProducts(prodRes.products || []);
    setCategories(cats);
    setBrands(brs);
    setSizeCharts(scs);
    setAuditLogs(auditRes.logs || []);
    setStockMovements(stockRes.movements || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadWorkspace();
    }
  }, [authLoading, loadWorkspace]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const displayStatus = getProductDisplayStatus(p);
      if (statusFilter !== "all" && displayStatus !== statusFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.fabric || ""} ${p.hsn_code || ""} ${
          p.category?.name || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, statusFilter, searchTerm]);

  const handleTogglePublish = async (p: Product) => {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_publish",
        is_active: !p.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Unable to update visibility.");
      return;
    }
    showNotice(
      "success",
      !p.is_active
        ? `"${p.name}" is now live in catalog.`
        : `"${p.name}" unpublished from public catalog.`
    );
    await loadWorkspace();
  };

  const handleOpenHistory = async (p: Product) => {
    setHistoryProduct(p);
    setStatusHistory([]);
    const res = await fetch(`/api/products/${p.id}`);
    const data = await res.json();
    if (res.ok && data.statusHistory) {
      setStatusHistory(data.statusHistory);
    }
  };

  const handleDuplicate = async (p: Product) => {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${p.name} (Copy)`,
        category_id: p.category_id,
        brand_id: p.brand_id,
        fabric: p.fabric,
        description: p.description,
        care_instructions: p.care_instructions,
        hsn_code: p.hsn_code || "5007",
        gst_rate: p.gst_rate ?? 5,
        mrp: p.mrp,
        retail_price: p.retail_price,
        b2b_moq: p.b2b_moq ?? 10,
        sell_retail: p.sell_retail,
        sell_b2b: p.sell_b2b,
        submissionMode: "draft",
        variants: (p.variants || []).map((v, i) => ({
          size: v.size,
          color: v.color,
          sku: `${v.sku}-COPY-${Date.now().toString().slice(-4)}-${i}`,
          stock_qty: v.stock_qty ?? 0,
        })),
        price_slabs: (p.price_slabs || []).map((s) => ({
          min_qty: s.min_qty,
          unit_price: s.unit_price,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice("error", data.error || "Unable to duplicate listing.");
      return;
    }
    showNotice("success", `Draft copy created from "${p.name}".`);
    await loadWorkspace();
  };

  const handleDownloadCsvTemplate = () => {
    const csv = generateProductCsvTemplate(categories[0]?.slug || "silk-sarees");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trio_dealers_product_template.csv";
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
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bulk import failed.");
      }
      setShowCsvModal(false);
      setCsvText("");
      showNotice(
        "success",
        `Imported ${data.importedCount || 0} products into approval queue.`
      );
      await loadWorkspace();
    } catch (err: any) {
      showNotice("error", err.message || "CSV import error.");
    } finally {
      setImportingCsv(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading seller catalog workspace...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-4">
        <Store className="w-10 h-10 text-gold-400 mx-auto" />
        <h1 className="text-2xl font-heading font-bold text-ink">
          Seller Mill Account Required
        </h1>
        <p className="text-xs text-ink-secondary">
          Only registered seller mills can create and manage product listings.
        </p>
        <Link
          href="/seller/register"
          className="btn-gold-luxury px-6 py-3 rounded-xl text-xs inline-block"
        >
          Apply for Seller Account
        </Link>
      </div>
    );
  }

  const isShopApproved = shop.kyc_status === "approved";

  return (
    <div className="bg-canvas py-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <Package className="w-3.5 h-3.5" /> Seller Product & Inventory Manager
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink">
              {shop.shop_name} — Product Studio
            </h1>
            <p className="text-xs text-ink-secondary">
              Create drafts, submit weaves for approval, manage B2B price slabs, and update live SKU stock.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/shop-dashboard"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition"
            >
              ← Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              disabled={!isShopApproved}
              className="px-4 py-2.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4 text-gold-400" />
              Bulk CSV
            </button>
            <button
              type="button"
              disabled={!isShopApproved}
              onClick={() => {
                setEditingProduct(null);
                setShowFormModal(true);
              }}
              className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>

        {!isShopApproved && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
            <Clock className="w-5 h-5 shrink-0" />
            <span>
              Your seller KYC status is currently{" "}
              <strong className="uppercase">{shop.kyc_status}</strong>. Adding or submitting new products is locked until Admin approves your shop.
            </span>
          </div>
        )}

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
            Products ({products.length})
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
            Audit Log ({auditLogs.length})
          </button>
        </div>

        {activeTab === "catalog" && (
          <div className="space-y-5">
            {/* Search & Status Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                        : "bg-surface border border-edge text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search SKU name, HSN, fabric..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-input border border-edge text-xs text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="p-12 rounded-3xl luxury-card text-center space-y-3">
                <Package className="w-10 h-10 text-ink-muted mx-auto" />
                <p className="text-sm font-bold text-ink">
                  No products in this view
                </p>
                <p className="text-xs text-ink-secondary">
                  Click &ldquo;Add Product&rdquo; or use Bulk CSV to add listings.
                </p>
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
                            {p.category && (
                              <span className="text-[11px] text-ink-muted">
                                {p.category.name}
                              </span>
                            )}
                            {p.hsn_code && (
                              <span className="text-[10px] font-mono text-ink-muted">
                                HSN {p.hsn_code} • {p.gst_rate ?? 5}% GST
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
                            <span>
                              Stock:{" "}
                              <strong className="text-ink">
                                {totalStock} units
                              </strong>{" "}
                              ({p.variants?.length || 0} variants)
                            </span>
                            {p.sell_b2b && p.price_slabs && p.price_slabs.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-gold-400 font-semibold">
                                  B2B from{" "}
                                  {formatINR(
                                    p.price_slabs[p.price_slabs.length - 1]
                                      .unit_price
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          {p.moderation_note && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl mt-1">
                              Admin Note: {p.moderation_note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {displayStatus === "approved" && (
                          <Link
                            href={`/product/${p.slug}`}
                            className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink hover:border-gold-500 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-gold-400" />
                            View
                          </Link>
                        )}

                        {displayStatus !== "archived" && (
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
                        )}

                        {(displayStatus === "approved" ||
                          displayStatus === "unpublished") && (
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(p)}
                            className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink hover:border-gold-500 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            {p.is_active ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                Publish
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenHistory(p)}
                          className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink-secondary hover:text-ink text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </button>

                        {displayStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={() => handleDuplicate(p)}
                            className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink-secondary hover:text-gold-400 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </button>
                        )}

                        {displayStatus !== "archived" && (
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
            onStockAdjusted={loadWorkspace}
          />
        )}

        {activeTab === "audit" && <ProductAuditTable logs={auditLogs} />}
      </div>

      {/* Modals */}
      {showFormModal && (
        <ProductFormModal
          product={editingProduct}
          isAdmin={false}
          categories={categories}
          brands={brands}
          sizeCharts={sizeCharts}
          onClose={() => setShowFormModal(false)}
          onSaved={async (msg) => {
            setShowFormModal(false);
            showNotice("success", msg);
            await loadWorkspace();
          }}
        />
      )}

      {deletingProduct && (
        <ProductDeleteModal
          product={deletingProduct}
          isAdmin={false}
          onClose={() => setDeletingProduct(null)}
          onCompleted={async (msg) => {
            setDeletingProduct(null);
            showNotice("success", msg);
            await loadWorkspace();
          }}
        />
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-ink">
                  Bulk CSV Product Import
                </h3>
                <p className="text-xs text-ink-secondary">
                  All imported CSV rows are queued for admin moderation before going live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-subtle border border-edge text-xs">
              <span className="text-ink-secondary">
                Download formatted template with required columns & sample saree row
              </span>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-3.5 py-1.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-gold-400 font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV header and rows here..."
              className="w-full p-3.5 rounded-2xl bg-surface-input border border-edge text-xs font-mono text-ink outline-none focus:border-gold-500"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importingCsv || !csvText.trim()}
                onClick={handleBulkImport}
                className="btn-gold-luxury px-5 py-2 rounded-xl text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {importingCsv ? "Importing..." : "Import CSV Products"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-heading font-bold text-sm text-ink">
                Status History — {historyProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryProduct(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">
                No moderation status transitions logged yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto text-xs">
                {statusHistory.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-2xl bg-surface-subtle border border-edge space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">
                        {h.from_status || "new"} →{" "}
                        <span className="text-gold-400">{h.to_status}</span>
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted">
                        {formatDateTime(h.created_at)}
                      </span>
                    </div>
                    {h.note && <p className="text-ink-secondary">{h.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
