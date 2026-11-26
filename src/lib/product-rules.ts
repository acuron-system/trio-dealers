import { Product, ProductApprovalStatus, ProductAudience } from "@/types/database";

export type ProductDisplayStatus =
  | "draft"
  | "pending"
  | "approved"
  | "unpublished"
  | "changes_requested"
  | "rejected"
  | "archived";

export interface ProductVariantInput {
  id?: string;
  size: string;
  color: string;
  color_hex?: string | null;
  sku?: string | null;
  stock_qty: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export interface ProductSlabInput {
  id?: string;
  min_qty: number;
  unit_price: number;
}

export interface ProductPayloadInput {
  name: string;
  slug?: string;
  category_id?: string | null;
  brand_id?: string | null;
  size_chart_id?: string | null;
  shop_id?: string;
  fabric?: string | null;
  fit?: string | null;
  pattern?: string | null;
  occasion?: string | null;
  audience?: ProductAudience | null;
  description?: string | null;
  care_instructions?: string | null;
  video_url?: string | null;
  hsn_code?: string | null;
  gst_rate: number;
  mrp: number;
  retail_price: number;
  b2b_moq: number;
  sell_retail: boolean;
  sell_b2b: boolean;
  images: string[];
  image_metadata?: Array<{ url: string; variant_color?: string | null; alt_text?: string | null }>;
  variants: ProductVariantInput[];
  price_slabs: ProductSlabInput[];
}

export const MIN_IMAGES_FOR_APPROVAL = 2;
export const VALID_GST_RATES = [5, 12, 18, 28];
export const VALID_AUDIENCES: ProductAudience[] = ["women", "men", "kids", "unisex"];

export function getProductDisplayStatus(product: Pick<Product, "approval_status" | "is_active" | "is_archived" | "deleted_at">): ProductDisplayStatus {
  if (product.is_archived || product.deleted_at) {
    return "archived";
  }
  const status = product.approval_status || "pending";
  if (status === "approved") {
    return product.is_active ? "approved" : "unpublished";
  }
  return status;
}

export function isProductAvailableToBuyers(product?: Partial<Product> | null): boolean {
  if (!product) return false;
  if (product.is_archived || product.deleted_at) return false;
  if (!product.is_active || product.approval_status !== "approved") return false;
  if (product.shop && product.shop.kyc_status && product.shop.kyc_status !== "approved") {
    return false;
  }
  return true;
}

/**
 * Validates product submission payloads.
 * Draft saves allow incomplete media/tax info; submitting for approval or publishing requires HSN, GST %, and >= 2 images.
 */
export function validateProductSubmission(
  input: ProductPayloadInput,
  targetStatus: ProductApprovalStatus
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length < 3) {
    errors.push("Product name must be at least 3 characters.");
  }

  if (!Number.isFinite(input.retail_price) || input.retail_price <= 0) {
    errors.push("Retail price must be greater than ₹0.");
  }

  if (!Number.isFinite(input.mrp) || input.mrp < input.retail_price) {
    errors.push("MRP must be greater than or equal to the retail price.");
  }

  if (!input.sell_retail && !input.sell_b2b) {
    errors.push("Select at least one buyer channel (Retail or B2B Wholesale).");
  }

  if (input.sell_b2b && (!Number.isFinite(input.b2b_moq) || input.b2b_moq < 1)) {
    errors.push("B2B Minimum Order Quantity (MOQ) must be at least 1.");
  }

  if (!input.variants || input.variants.length === 0) {
    errors.push("Add at least one size/color variant.");
  } else {
    input.variants.forEach((v, idx) => {
      if (!v.size?.trim() || !v.color?.trim()) {
        errors.push(`Variant #${idx + 1} requires both size and color.`);
      }
      if (!Number.isFinite(v.stock_qty) || v.stock_qty < 0) {
        errors.push(`Variant #${idx + 1} stock quantity cannot be negative.`);
      }
    });
  }

  if (input.audience && !VALID_AUDIENCES.includes(input.audience)) {
    errors.push("Audience must be one of: women, men, kids, or unisex.");
  }

  if (input.video_url?.trim()) {
    try {
      const parsed = new URL(input.video_url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        errors.push("Video URL must start with http:// or https://.");
      }
    } catch {
      errors.push("Video URL is not a valid link.");
    }
  }

  // Strict Section 5 submission rules for non-draft listings
  if (targetStatus !== "draft") {
    if (!input.fabric?.trim()) {
      errors.push("Fabric composition is required before submitting for approval.");
    }
    if (!input.description?.trim() || input.description.trim().length < 15) {
      errors.push("Description (at least 15 characters) is required before submitting for approval.");
    }
    const cleanHsn = (input.hsn_code || "").trim();
    if (!cleanHsn || cleanHsn.length < 4) {
      errors.push("Valid HSN code (at least 4 digits) is required before submitting for approval.");
    }
    if (!Number.isFinite(input.gst_rate) || input.gst_rate <= 0 || input.gst_rate > 28) {
      errors.push("Valid GST rate (> 0% and <= 28%) is required before submitting for approval.");
    }
    const validImages = (input.images || []).map((u) => u.trim()).filter(Boolean);
    if (validImages.length < MIN_IMAGES_FOR_APPROVAL) {
      errors.push(`At least ${MIN_IMAGES_FOR_APPROVAL} product images are required before submitting for approval.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determines whether a live approved product edit touches moderated fields (name, description, or images).
 * Price and stock changes apply immediately; content/media changes trigger re-review.
 */
export function didLiveContentChange(
  existing: {
    name?: string | null;
    description?: string | null;
    images?: Array<{ url: string; sort_order?: number }>;
  },
  next: {
    name: string;
    description?: string | null;
    images: string[];
  }
): boolean {
  const prevName = (existing.name || "").trim();
  const nextName = (next.name || "").trim();
  if (prevName !== nextName) return true;

  const prevDesc = (existing.description || "").trim();
  const nextDesc = (next.description || "").trim();
  if (prevDesc !== nextDesc) return true;

  const prevImgs = [...(existing.images || [])]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((i) => i.url.trim())
    .filter(Boolean);
  const nextImgs = (next.images || []).map((u) => u.trim()).filter(Boolean);

  if (prevImgs.length !== nextImgs.length) return true;
  for (let i = 0; i < prevImgs.length; i++) {
    if (prevImgs[i] !== nextImgs[i]) return true;
  }

  return false;
}

export function slugifyProductName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "trio-textile";
}

export function generateProductCsvTemplate(defaultCategorySlug = "silk-sarees"): string {
  const headers = [
    "name",
    "category_slug",
    "fabric",
    "fit",
    "pattern",
    "occasion",
    "audience",
    "description",
    "care_instructions",
    "hsn_code",
    "gst_rate",
    "mrp",
    "retail_price",
    "b2b_moq",
    "sell_retail",
    "sell_b2b",
    "size",
    "color",
    "color_hex",
    "sku",
    "stock_qty",
    "slab1_min_qty",
    "slab1_price",
    "slab2_min_qty",
    "slab2_price",
    "image_url_1",
    "image_url_2",
    "video_url",
  ];

  const sampleRow = [
    "Royal Paithani Zari Silk Saree",
    defaultCategorySlug,
    "Pure Handloom Paithani Silk",
    "Traditional Drape",
    "Peacock Zari Border",
    "Wedding & Festive",
    "women",
    "Woven pure mulberry silk Paithani saree with rich peacock pallu and traditional zari border.",
    "Dry clean only. Store in breathable muslin wrap away from direct sunlight.",
    "5007",
    "5",
    "7999",
    "5499",
    "10",
    "true",
    "true",
    "Free Size (6.3m)",
    "Royal Magenta & Gold",
    "#8B004B",
    "TD-PAI-001",
    "40",
    "10",
    "4299",
    "50",
    "3899",
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=900&q=80",
    "",
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return `${headers.join(",")}\n${sampleRow.map(escapeCsv).join(",")}\n`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface ParsedBulkCsvRow {
  rowNumber: number;
  categorySlug: string;
  payload: ProductPayloadInput;
}

export function parseBulkProductCsv(csvText: string): {
  rows: ParsedBulkCsvRow[];
  parseErrors: string[];
} {
  const rawLines = csvText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length < 2) {
    return { rows: [], parseErrors: ["CSV file must include a header row and at least one product row."] };
  }

  const headers = splitCsvLine(rawLines[0]).map((h) => h.toLowerCase().trim());
  const rows: ParsedBulkCsvRow[] = [];
  const parseErrors: string[] = [];

  for (let idx = 1; idx < rawLines.length; idx++) {
    const values = splitCsvLine(rawLines[idx]);
    const record: Record<string, string> = {};
    headers.forEach((h, cIdx) => {
      record[h] = values[cIdx] ?? "";
    });

    const retailPrice = parseFloat(record.retail_price || "0");
    const mrp = parseFloat(record.mrp || String(retailPrice || 0));
    const gstRate = parseFloat(record.gst_rate || "0");
    const b2bMoq = parseInt(record.b2b_moq || "10", 10);
    const stockQty = parseInt(record.stock_qty || "0", 10);
    const images = [record.image_url_1, record.image_url_2, record.image_url_3, record.image_url_4]
      .map((u) => (u || "").trim())
      .filter(Boolean);

    const priceSlabs: ProductSlabInput[] = [];
    const s1Min = parseInt(record.slab1_min_qty || "0", 10);
    const s1Price = parseFloat(record.slab1_price || "0");
    if (s1Min > 0 && s1Price > 0) priceSlabs.push({ min_qty: s1Min, unit_price: s1Price });

    const s2Min = parseInt(record.slab2_min_qty || "0", 10);
    const s2Price = parseFloat(record.slab2_price || "0");
    if (s2Min > 0 && s2Price > 0) priceSlabs.push({ min_qty: s2Min, unit_price: s2Price });

    const payload: ProductPayloadInput = {
      name: record.name || "",
      category_id: null,
      brand_id: null,
      size_chart_id: null,
      fabric: record.fabric || "",
      fit: record.fit || "",
      pattern: record.pattern || "",
      occasion: record.occasion || "",
      audience: VALID_AUDIENCES.includes(record.audience as ProductAudience)
        ? (record.audience as ProductAudience)
        : "unisex",
      description: record.description || "",
      care_instructions: record.care_instructions || "",
      video_url: record.video_url || "",
      hsn_code: record.hsn_code || "",
      gst_rate: Number.isFinite(gstRate) ? gstRate : 0,
      mrp: Number.isFinite(mrp) ? mrp : 0,
      retail_price: Number.isFinite(retailPrice) ? retailPrice : 0,
      b2b_moq: Number.isFinite(b2bMoq) && b2bMoq > 0 ? b2bMoq : 10,
      sell_retail: record.sell_retail ? record.sell_retail.toLowerCase() !== "false" : true,
      sell_b2b: record.sell_b2b ? record.sell_b2b.toLowerCase() !== "false" : true,
      images,
      variants: [
        {
          size: record.size || "Free Size",
          color: record.color || "Standard",
          color_hex: record.color_hex || undefined,
          sku: record.sku || undefined,
          stock_qty: Number.isFinite(stockQty) ? stockQty : 0,
        },
      ],
      price_slabs: priceSlabs,
    };

    const validation = validateProductSubmission(payload, "pending");
    if (!validation.valid) {
      parseErrors.push(`Row ${idx + 1} (${payload.name || "Unnamed"}): ${validation.errors.join(" ")}`);
    } else {
      rows.push({
        rowNumber: idx + 1,
        categorySlug: (record.category_slug || "").toLowerCase(),
        payload,
      });
    }
  }

  return { rows, parseErrors };
}

