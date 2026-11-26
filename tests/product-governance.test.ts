import { describe, it, expect } from "vitest";
import {
  didLiveContentChange,
  generateProductCsvTemplate,
  getProductDisplayStatus,
  isProductAvailableToBuyers,
  parseBulkProductCsv,
  ProductPayloadInput,
  validateProductSubmission,
} from "../src/lib/product-rules";

const validBaseInput: ProductPayloadInput = {
  name: "Royal Kanjivaram Silk Saree",
  category_id: "cat-1",
  fabric: "Pure Mulberry Silk",
  description: "Handwoven golden zari Kanjivaram wedding silk saree with rich contrast pallu.",
  care_instructions: "Dry clean only.",
  video_url: "https://example.com/reel.mp4",
  hsn_code: "5007",
  gst_rate: 5,
  mrp: 6999,
  retail_price: 4499,
  b2b_moq: 10,
  sell_retail: true,
  sell_b2b: true,
  images: [
    "https://example.com/cover.jpg",
    "https://example.com/detail.jpg",
  ],
  variants: [{ size: "Free Size (6.3m)", color: "Crimson Gold", stock_qty: 20 }],
  price_slabs: [{ min_qty: 10, unit_price: 2999 }],
};

describe("Product Submission Policy & Validation", () => {
  it("allows saving incomplete listings as draft", () => {
    const res = validateProductSubmission(
      {
        ...validBaseInput,
        hsn_code: "",
        gst_rate: 0,
        images: [],
        description: "WIP",
      },
      "draft"
    );
    expect(res.valid).toBe(true);
  });

  it("blocks submitting for approval with fewer than 2 images or missing HSN/GST", () => {
    const res = validateProductSubmission(
      {
        ...validBaseInput,
        hsn_code: "",
        gst_rate: 0,
        images: ["https://example.com/only-one.jpg"],
      },
      "pending"
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("HSN"))).toBe(true);
    expect(res.errors.some((e) => e.includes("GST"))).toBe(true);
    expect(res.errors.some((e) => e.includes("2 product images"))).toBe(true);
  });

  it("accepts complete submission with >= 2 images, valid HSN, and GST %", () => {
    const res = validateProductSubmission(
      {
        ...validBaseInput,
        audience: "women",
        fit: "Traditional Drape",
        pattern: "Zari Border",
        occasion: "Wedding",
      },
      "pending"
    );
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("rejects invalid audience values", () => {
    const res = validateProductSubmission(
      {
        ...validBaseInput,
        audience: "invalid_group" as any,
      },
      "draft"
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Audience"))).toBe(true);
  });
});

describe("Live Product Edit Re-Review & Lifecycle Status", () => {
  it("does not trigger re-review when only price, stock, or care instructions change", () => {
    const existing = {
      name: validBaseInput.name,
      description: validBaseInput.description,
      images: [
        { url: "https://example.com/cover.jpg", sort_order: 1 },
        { url: "https://example.com/detail.jpg", sort_order: 2 },
      ],
    };

    const changed = didLiveContentChange(existing, {
      name: validBaseInput.name,
      description: validBaseInput.description,
      images: [
        "https://example.com/cover.jpg",
        "https://example.com/detail.jpg",
      ],
    });
    expect(changed).toBe(false);
  });

  it("triggers re-review when live product name, description, or images change", () => {
    const existing = {
      name: validBaseInput.name,
      description: validBaseInput.description,
      images: [
        { url: "https://example.com/cover.jpg", sort_order: 1 },
        { url: "https://example.com/detail.jpg", sort_order: 2 },
      ],
    };

    expect(
      didLiveContentChange(existing, {
        name: "Renamed Luxury Silk",
        description: validBaseInput.description,
        images: ["https://example.com/cover.jpg", "https://example.com/detail.jpg"],
      })
    ).toBe(true);

    expect(
      didLiveContentChange(existing, {
        name: validBaseInput.name,
        description: "Swapped product description with unapproved claims.",
        images: ["https://example.com/cover.jpg", "https://example.com/detail.jpg"],
      })
    ).toBe(true);

    expect(
      didLiveContentChange(existing, {
        name: validBaseInput.name,
        description: validBaseInput.description,
        images: ["https://example.com/new-cover.jpg", "https://example.com/detail.jpg"],
      })
    ).toBe(true);
  });

  it("computes display statuses and buyer availability accurately", () => {
    expect(
      getProductDisplayStatus({ approval_status: "approved", is_active: true, is_archived: false })
    ).toBe("approved");
    expect(
      getProductDisplayStatus({ approval_status: "approved", is_active: false, is_archived: false })
    ).toBe("unpublished");
    expect(
      getProductDisplayStatus({ approval_status: "approved", is_active: true, is_archived: true })
    ).toBe("archived");

    expect(
      isProductAvailableToBuyers({
        approval_status: "approved",
        is_active: true,
        is_archived: false,
        deleted_at: null,
        shop: { kyc_status: "approved" } as any,
      })
    ).toBe(true);

    expect(
      isProductAvailableToBuyers({
        approval_status: "approved",
        is_active: true,
        is_archived: true,
      })
    ).toBe(false);

    expect(
      isProductAvailableToBuyers({
        approval_status: "approved",
        is_active: true,
        is_archived: false,
        shop: { kyc_status: "suspended" } as any,
      })
    ).toBe(false);
  });
});

describe("Bulk CSV Product Template & Parsing", () => {
  it("parses the generated CSV template cleanly with extended attributes", () => {
    const csv = generateProductCsvTemplate("silk-sarees");
    const parsed = parseBulkProductCsv(csv);
    expect(parsed.parseErrors.length).toBe(0);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].categorySlug).toBe("silk-sarees");
    expect(parsed.rows[0].payload.audience).toBe("women");
    expect(parsed.rows[0].payload.variants[0].color_hex).toBe("#8B004B");
    expect(parsed.rows[0].payload.images.length).toBe(2);
  });

  it("rejects CSV rows violating HSN, GST, or 2-image policy", () => {
    const csv =
      "name,category_slug,fabric,description,care_instructions,hsn_code,gst_rate,mrp,retail_price,b2b_moq,sell_retail,sell_b2b,size,color,sku,stock_qty,slab1_min_qty,slab1_price,slab2_min_qty,slab2_price,image_url_1,image_url_2,video_url\n" +
      '"Cotton Cut",cotton,"Cotton","Fine cotton shirting cloth 2.5m cut","Wash gently","",0,1500,1000,10,true,true,2.5m,White,SKU1,20,10,800,,,https://example.com/1.jpg,,\n';
    const parsed = parseBulkProductCsv(csv);
    expect(parsed.rows.length).toBe(0);
    expect(parsed.parseErrors.length).toBe(1);
  });
});

