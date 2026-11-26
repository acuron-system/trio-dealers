"use client";

import React, { useState } from "react";
import {
  Brand,
  Category,
  Product,
  ProductAudience,
  Shop,
  SizeChart,
} from "@/types/database";
import {
  ProductSlabInput,
  ProductVariantInput,
  VALID_GST_RATES,
} from "@/lib/product-rules";
import { Plus, Trash2, UploadCloud, X, AlertCircle } from "lucide-react";

interface ProductFormModalProps {
  product?: Product | null;
  isAdmin: boolean;
  categories: Category[];
  brands: Brand[];
  sizeCharts: SizeChart[];
  shops?: Shop[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ProductFormModal({
  product,
  isAdmin,
  categories,
  brands,
  sizeCharts,
  shops = [],
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const isEditing = Boolean(product);

  const [shopId, setShopId] = useState(product?.shop_id || "");
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(
    product?.category_id || categories[0]?.id || ""
  );
  const [brandId, setBrandId] = useState(product?.brand_id || "");
  const [sizeChartId, setSizeChartId] = useState(product?.size_chart_id || "");
  const [audience, setAudience] = useState<ProductAudience>(
    product?.audience || "women"
  );
  const [fabric, setFabric] = useState(product?.fabric || "");
  const [fit, setFit] = useState(product?.fit || "");
  const [pattern, setPattern] = useState(product?.pattern || "");
  const [occasion, setOccasion] = useState(product?.occasion || "");
  const [description, setDescription] = useState(product?.description || "");
  const [careInstructions, setCareInstructions] = useState(
    product?.care_instructions || ""
  );
  const [videoUrl, setVideoUrl] = useState(product?.video_url || "");
  const [hsnCode, setHsnCode] = useState(product?.hsn_code || "5007");
  const [gstRate, setGstRate] = useState<number>(product?.gst_rate ?? 5);
  const [mrp, setMrp] = useState<number>(product?.mrp ?? 4999);
  const [retailPrice, setRetailPrice] = useState<number>(
    product?.retail_price ?? 3499
  );
  const [b2bMoq, setB2bMoq] = useState<number>(product?.b2b_moq ?? 10);
  const [sellRetail, setSellRetail] = useState<boolean>(
    product?.sell_retail ?? true
  );
  const [sellB2b, setSellB2b] = useState<boolean>(product?.sell_b2b ?? true);

  const [images, setImages] = useState<string[]>(
    product?.images?.map((i) => i.url) || []
  );
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [variants, setVariants] = useState<ProductVariantInput[]>(
    product?.variants && product.variants.length > 0
      ? product.variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          color_hex: v.color_hex || "#D4AF37",
          sku: v.sku || "",
          stock_qty: v.stock_qty,
        }))
      : [
          {
            size: "Free Size (6.3m)",
            color: "Royal Gold",
            color_hex: "#D4AF37",
            sku: "",
            stock_qty: 25,
          },
        ]
  );

  const [slabs, setSlabs] = useState<ProductSlabInput[]>(
    product?.price_slabs && product.price_slabs.length > 0
      ? product.price_slabs.map((s) => ({
          id: s.id,
          min_qty: s.min_qty,
          unit_price: s.unit_price,
        }))
      : [
          { min_qty: 10, unit_price: 2999 },
          { min_qty: 50, unit_price: 2599 },
        ]
  );

  const [savingMode, setSavingMode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploadingFiles(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Image upload failed.");
      }
      if (Array.isArray(data.urls)) {
        setImages((prev) => [...prev, ...data.urls]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not upload image files.");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    setImages((prev) => [...prev, trimmed]);
    setImageUrlInput("");
  };

  const submitForm = async (
    submitMode: "draft" | "submit" | "publish_now"
  ) => {
    setErrorMsg(null);
    setSavingMode(submitMode);

    const payload: any = {
      shop_id: isAdmin ? shopId || undefined : undefined,
      name,
      category_id: categoryId || null,
      brand_id: brandId || null,
      size_chart_id: sizeChartId || null,
      audience,
      fabric,
      fit,
      pattern,
      occasion,
      description,
      care_instructions: careInstructions,
      video_url: videoUrl,
      hsn_code: hsnCode,
      gst_rate: Number(gstRate),
      mrp: Number(mrp),
      retail_price: Number(retailPrice),
      b2b_moq: Number(b2bMoq),
      sell_retail: sellRetail,
      sell_b2b: sellB2b,
      images,
      variants,
      price_slabs: sellB2b ? slabs : [],
      submitMode: submitMode === "publish_now" ? "submit" : submitMode,
    };

    if (!isEditing && submitMode === "publish_now") {
      payload.submitMode = "publish_now";
    } else if (isEditing && submitMode === "publish_now" && isAdmin) {
      payload.approveImmediately = true;
    }

    try {
      const res = await fetch(
        isEditing ? `/api/products/${product!.id}` : "/api/products",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product.");
      }

      onSaved(
        isEditing
          ? `"${name}" updated successfully.`
          : submitMode === "draft"
          ? `"${name}" saved as draft.`
          : submitMode === "publish_now"
          ? `"${name}" published live!`
          : `"${name}" submitted for admin approval.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Error saving product.");
      setSavingMode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-4xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between border-b border-edge pb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-ink">
              {isEditing ? "Edit Product Listing" : "Add New Textile Product"}
            </h2>
            <p className="text-xs text-ink-secondary">
              Include at least 2 images, valid HSN & GST %, variants, and wholesale slabs before submitting for approval.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-6 text-xs">
          {/* Admin Target Shop Selector */}
          {isAdmin && !isEditing && (
            <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-2">
              <label className="block font-bold text-gold-400 uppercase tracking-wider text-[11px]">
                Assign Listing Ownership
              </label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="">Trio Dealers House Stock (Platform Own)</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shop_name} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Basics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-ink-secondary">
                Product Title *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Kanjivaram Gold Zari Silk Saree"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink focus:border-gold-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Brand / Mill House
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="">None / Generic Mill</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Audience
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as ProductAudience)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="women">Women</option>
                <option value="men">Men</option>
                <option value="kids">Kids</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Measurement Size Chart
              </label>
              <select
                value={sizeChartId}
                onChange={(e) => setSizeChartId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="">No size chart</option>
                {sizeCharts.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Fabric Composition *
              </label>
              <input
                type="text"
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
                placeholder="e.g. Pure Mulberry Silk with Zari"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Drape / Fit
              </label>
              <input
                type="text"
                value={fit}
                onChange={(e) => setFit(e.target.value)}
                placeholder="e.g. Regular Fit / 6.3m Unstitched"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Pattern / Weave
              </label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. Floral Zari Brocade"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Occasion
              </label>
              <input
                type="text"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="e.g. Bridal, Festive, Executive"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-ink-secondary">
                Description * (min 15 chars for submission)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe weave craft, border finish, included blouse piece or cut dimensions..."
                className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-ink-secondary">
                Care Instructions
              </label>
              <input
                type="text"
                value={careInstructions}
                onChange={(e) => setCareInstructions(e.target.value)}
                placeholder="e.g. Dry clean only. Store wrapped in muslin cloth."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>
          </div>

          {/* Media */}
          <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-ink">
                Product Images ({images.length}) — First image is Cover
              </span>
              <label className="px-3.5 py-1.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-ink font-semibold cursor-pointer inline-flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-gold-400" />
                {uploadingFiles ? "Uploading..." : "Upload Image Files"}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadImages}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Or paste https:// image URL..."
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2 rounded-xl bg-surface border border-edge text-ink font-bold hover:border-gold-500"
              >
                Add URL
              </button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden border border-edge group bg-surface"
                  >
                    <img
                      src={url}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-gold-300 text-[9px] font-bold">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-90 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-ink-secondary">
                Optional Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full px-3.5 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>
          </div>

          {/* Pricing & GST */}
          <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-4">
            <span className="font-bold text-ink block">
              Pricing, Channels & GST Classification
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-ink-secondary mb-1">MRP (₹) *</label>
                <input
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-secondary mb-1">
                  Retail Price (₹) *
                </label>
                <input
                  type="number"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-secondary mb-1">
                  HSN Code *
                </label>
                <input
                  type="text"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-secondary mb-1">GST % *</label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                >
                  {VALID_GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}% GST
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-secondary mb-1">B2B MOQ</label>
                <input
                  type="number"
                  min={1}
                  value={b2bMoq}
                  onChange={(e) => setB2bMoq(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={sellRetail}
                  onChange={(e) => setSellRetail(e.target.checked)}
                  className="w-4 h-4 accent-gold-500 rounded"
                />
                Sell to Retail Customers
              </label>
              <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={sellB2b}
                  onChange={(e) => setSellB2b(e.target.checked)}
                  className="w-4 h-4 accent-gold-500 rounded"
                />
                Sell to B2B Wholesale Buyers
              </label>
            </div>
          </div>

          {/* Variants */}
          <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">
                Size & Color Variants ({variants.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      size: "Free Size",
                      color: "",
                      color_hex: "#D4AF37",
                      sku: "",
                      stock_qty: 10,
                    },
                  ])
                }
                className="px-3 py-1 rounded-lg bg-surface border border-edge text-gold-400 font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variant
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="Size"
                    value={v.size}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, size: e.target.value } : row
                        )
                      )
                    }
                    className="px-2.5 py-2 rounded-lg bg-surface-input border border-edge text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Color"
                    value={v.color}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, color: e.target.value } : row
                        )
                      )
                    }
                    className="px-2.5 py-2 rounded-lg bg-surface-input border border-edge text-ink"
                  />
                  <input
                    type="color"
                    value={v.color_hex || "#D4AF37"}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, color_hex: e.target.value } : row
                        )
                      )
                    }
                    className="h-9 w-full rounded-lg bg-surface-input border border-edge p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="SKU"
                    value={v.sku || ""}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, sku: e.target.value } : row
                        )
                      )
                    }
                    className="px-2.5 py-2 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Stock"
                    value={v.stock_qty}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                stock_qty: parseInt(e.target.value, 10) || 0,
                              }
                            : row
                        )
                      )
                    }
                    className="px-2.5 py-2 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                  />
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() =>
                      setVariants((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 rounded-lg text-ink-muted hover:text-red-600 disabled:opacity-30 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* B2B Slabs */}
          {sellB2b && (
            <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">
                  Wholesale B2B Quantity Price Slabs ({slabs.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSlabs((prev) => [
                      ...prev,
                      { min_qty: 20, unit_price: Math.max(100, retailPrice - 200) },
                    ])
                  }
                  className="px-3 py-1 rounded-lg bg-surface border border-edge text-gold-400 font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slab
                </button>
              </div>

              <div className="space-y-2">
                {slabs.map((slab, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-3 items-center">
                    <input
                      type="number"
                      min={1}
                      placeholder="Min Qty"
                      value={slab.min_qty}
                      onChange={(e) =>
                        setSlabs((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, min_qty: parseInt(e.target.value, 10) || 1 }
                              : row
                          )
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="Unit Price (₹)"
                      value={slab.unit_price}
                      onChange={(e) =>
                        setSlabs((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, unit_price: parseFloat(e.target.value) || 0 }
                              : row
                          )
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-surface-input border border-edge text-ink font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSlabs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-2 rounded-lg text-ink-muted hover:text-red-600 justify-self-start"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Submit Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge text-ink-secondary font-semibold"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => submitForm("draft")}
              className="px-5 py-2.5 rounded-xl bg-surface border border-edge hover:border-gold-500 text-ink font-bold disabled:opacity-50"
            >
              {savingMode === "draft" ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => submitForm("submit")}
              className="px-6 py-2.5 rounded-xl btn-gold-luxury uppercase tracking-wider disabled:opacity-50"
            >
              {savingMode === "submit"
                ? "Submitting..."
                : isEditing
                ? "Save & Submit"
                : "Submit for Approval"}
            </button>

            {isAdmin && (
              <button
                type="button"
                disabled={savingMode !== null}
                onClick={() => submitForm("publish_now")}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {savingMode === "publish_now" ? "Publishing..." : "Publish Now"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
