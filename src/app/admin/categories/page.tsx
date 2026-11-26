"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchBrands, fetchCategories, fetchSizeCharts } from "@/lib/db";
import { slugifyProductName } from "@/lib/product-rules";
import { Brand, Category, SizeChart } from "@/types/database";
import {
  AlertCircle,
  CheckCircle2,
  FolderTree,
  Plus,
  Ruler,
  Tag,
  Trash2,
} from "lucide-react";

export default function AdminCategoriesPage() {
  const [activeTab, setActiveTab] = useState<
    "categories" | "brands" | "size_charts"
  >("categories");

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Category form state
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catSort, setCatSort] = useState(1);

  // Brand form state
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState("");

  // Size chart form state
  const [chartName, setChartName] = useState("");
  const [chartCategoryId, setChartCategoryId] = useState("");
  const [chartColumns, setChartColumns] = useState("Size, Chest (in), Length (in)");
  const [chartRowsText, setChartRowsText] = useState(
    "M (38), 38, 42\nL (40), 40, 43\nXL (42), 42, 44"
  );

  const showNotice = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTaxonomy = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [cats, brs, scs] = await Promise.all([
      fetchCategories(supabase, true),
      fetchBrands(supabase, true),
      fetchSizeCharts(supabase),
    ]);
    setCategories(cats);
    setBrands(brs);
    setSizeCharts(scs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const supabase = createClient();
    const slug = (catSlug.trim() || slugifyProductName(catName)).toLowerCase();

    const { error } = await supabase.from("categories").insert({
      name: catName.trim(),
      slug,
      parent_id: catParentId || null,
      image_url: catImageUrl.trim() || null,
      sort_order: catSort,
      is_active: true,
    });

    if (error) {
      showNotice("error", error.message);
      return;
    }

    setCatName("");
    setCatSlug("");
    setCatParentId("");
    setCatImageUrl("");
    showNotice("success", `Category "${catName}" saved.`);
    await loadTaxonomy();
  };

  const handleToggleCategory = async (cat: Category) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !(cat.is_active ?? true) })
      .eq("id", cat.id);
    if (error) {
      showNotice("error", error.message);
      return;
    }
    await loadTaxonomy();
  };

  const handleDeleteCategory = async (cat: Category) => {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) {
      showNotice("error", error.message);
      return;
    }
    showNotice("success", `Category "${cat.name}" removed.`);
    await loadTaxonomy();
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("brands").insert({
      name: brandName.trim(),
      slug: slugifyProductName(brandName),
      logo_url: brandLogo.trim() || null,
      is_active: true,
    });
    if (error) {
      showNotice("error", error.message);
      return;
    }
    setBrandName("");
    setBrandLogo("");
    showNotice("success", `Brand "${brandName}" created.`);
    await loadTaxonomy();
  };

  const handleDeleteBrand = async (b: Brand) => {
    const supabase = createClient();
    const { error } = await supabase.from("brands").delete().eq("id", b.id);
    if (error) {
      showNotice("error", error.message);
      return;
    }
    showNotice("success", `Brand "${b.name}" deleted.`);
    await loadTaxonomy();
  };

  const handleCreateSizeChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chartName.trim()) return;
    const columns = chartColumns
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = chartRowsText
      .split("\n")
      .map((line) =>
        line
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      )
      .filter((r) => r.length > 0);

    const supabase = createClient();
    const { error } = await supabase.from("size_charts").insert({
      name: chartName.trim(),
      category_id: chartCategoryId || null,
      chart: { columns, rows },
    });

    if (error) {
      showNotice("error", error.message);
      return;
    }
    setChartName("");
    showNotice("success", `Size chart "${chartName}" added.`);
    await loadTaxonomy();
  };

  const handleDeleteSizeChart = async (sc: SizeChart) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("size_charts")
      .delete()
      .eq("id", sc.id);
    if (error) {
      showNotice("error", error.message);
      return;
    }
    showNotice("success", `Size chart removed.`);
    await loadTaxonomy();
  };

  const parentCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Categories, Brands & Size Charts
          </h1>
          <p className="text-xs text-ink-secondary">
            Configure multi-level textile departments, partner weave brands, and standardized garment measurement tables.
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

        <div className="flex items-center gap-2 border-b border-edge pb-2 text-xs font-bold uppercase tracking-wider overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "categories"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            Categories ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("brands")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "brands"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Brands ({brands.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("size_charts")}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "size_charts"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            Size Charts ({sizeCharts.length})
          </button>
        </div>

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleCreateCategory}
              className="lg:col-span-4 luxury-card rounded-3xl p-6 space-y-4 text-xs"
            >
              <h2 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <Plus className="w-4 h-4 text-gold-400" />
                Add Department / Sub-Category
              </h2>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Kanjivaram Pure Silk"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  URL Slug (Optional)
                </label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Parent Category (Optional)
                </label>
                <select
                  value={catParentId}
                  onChange={(e) => setCatParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                >
                  <option value="">None (Top-Level Department)</option>
                  {parentCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-ink-secondary">
                    Cover URL
                  </label>
                  <input
                    type="url"
                    value={catImageUrl}
                    onChange={(e) => setCatImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink-secondary">
                    Order
                  </label>
                  <input
                    type="number"
                    value={catSort}
                    onChange={(e) => setCatSort(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-gold-luxury py-3 rounded-xl uppercase tracking-wider"
              >
                Create Category
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              {loading ? (
                <div className="p-8 luxury-card rounded-3xl text-center text-xs text-ink-muted">
                  Loading taxonomy...
                </div>
              ) : (
                categories.map((cat) => {
                  const parent = categories.find((p) => p.id === cat.parent_id);
                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-2xl luxury-card flex flex-wrap items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-sm">
                            {cat.name}
                          </span>
                          {parent && (
                            <span className="px-2 py-0.5 rounded bg-surface-subtle border border-edge text-[10px] text-ink-secondary">
                              Sub of {parent.name}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              cat.is_active === false
                                ? "bg-surface-subtle text-ink-muted"
                                : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {cat.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-ink-muted">
                          /{cat.slug} • Order #{cat.sort_order ?? 0}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(cat)}
                          className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-edge text-ink hover:border-gold-500 font-semibold"
                        >
                          {cat.is_active === false ? "Activate" : "Disable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-2 rounded-xl text-ink-muted hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BRANDS TAB */}
        {activeTab === "brands" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleCreateBrand}
              className="lg:col-span-4 luxury-card rounded-3xl p-6 space-y-4 text-xs"
            >
              <h2 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <Plus className="w-4 h-4 text-gold-400" />
                Add Weave Brand / House
              </h2>
              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Kanchipuram Royal Guild"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={brandLogo}
                  onChange={(e) => setBrandLogo(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                />
              </div>
              <button
                type="submit"
                className="w-full btn-gold-luxury py-3 rounded-xl uppercase tracking-wider"
              >
                Add Brand
              </button>
            </form>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl luxury-card flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-ink text-sm">{b.name}</p>
                    <p className="font-mono text-[11px] text-ink-muted">
                      /{b.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBrand(b)}
                    className="p-2 rounded-xl text-ink-muted hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SIZE CHARTS TAB */}
        {activeTab === "size_charts" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleCreateSizeChart}
              className="lg:col-span-5 luxury-card rounded-3xl p-6 space-y-4 text-xs"
            >
              <h2 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                <Plus className="w-4 h-4 text-gold-400" />
                Create Garment Size Chart
              </h2>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Chart Title *
                </label>
                <input
                  type="text"
                  required
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  placeholder="e.g. Women Kurti Measurement Guide"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Associated Category
                </label>
                <select
                  value={chartCategoryId}
                  onChange={(e) => setChartCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
                >
                  <option value="">Universal / General</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Columns (comma-separated)
                </label>
                <input
                  type="text"
                  value={chartColumns}
                  onChange={(e) => setChartColumns(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-secondary">
                  Rows (one line per size, comma-separated)
                </label>
                <textarea
                  rows={4}
                  value={chartRowsText}
                  onChange={(e) => setChartRowsText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full btn-gold-luxury py-3 rounded-xl uppercase tracking-wider"
              >
                Save Size Chart
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              {sizeCharts.map((sc) => (
                <div
                  key={sc.id}
                  className="p-5 rounded-3xl luxury-card space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-ink text-sm">{sc.name}</h3>
                      <p className="text-[11px] text-ink-muted">
                        {sc.category?.name || "All Categories"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSizeChart(sc)}
                      className="p-2 rounded-xl text-ink-muted hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {sc.chart?.columns && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-edge text-[10px] uppercase text-ink-muted">
                            {sc.chart.columns.map((c, idx) => (
                              <th key={idx} className="py-1.5 pr-4">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                          {(sc.chart.rows || []).map((r, rIdx) => (
                            <tr key={rIdx} className="text-ink-secondary">
                              {r.map((cell, cIdx) => (
                                <td key={cIdx} className="py-1.5 pr-4">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
