import { describe, it, expect } from "vitest";

// Multi-vendor split and commission logic
describe("Multi-Vendor Marketplace Order Splitting", () => {
  const shop1 = {
    id: "shop-001",
    shop_name: "Rajesh Silk Mills",
    commission_rate: 10.0,
  };

  const shop2 = {
    id: "shop-002",
    shop_name: "Surat Cotton Loom",
    commission_rate: 8.5,
  };

  const cartItems = [
    {
      productId: "p1",
      shopId: shop1.id,
      shop: shop1,
      unitPrice: 4499,
      quantity: 2,
    },
    {
      productId: "p2",
      shopId: shop1.id,
      shop: shop1,
      unitPrice: 3899,
      quantity: 1,
    },
    {
      productId: "p3",
      shopId: shop2.id,
      shop: shop2,
      unitPrice: 1299,
      quantity: 5,
    },
  ];

  it("should split items into distinct sub-orders by shop", () => {
    const shopMap = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      if (!shopMap.has(item.shopId)) {
        shopMap.set(item.shopId, []);
      }
      shopMap.get(item.shopId)!.push(item);
    }

    expect(shopMap.size).toBe(2);
    expect(shopMap.get(shop1.id)?.length).toBe(2);
    expect(shopMap.get(shop2.id)?.length).toBe(1);
  });

  it("should calculate correct subtotal, commission, and shop earnings per sub-order", () => {
    // Shop 1: (4499 * 2) + (3899 * 1) = 8998 + 3899 = 12897
    const shop1Items = cartItems.filter((i) => i.shopId === shop1.id);
    const shop1Subtotal = shop1Items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const shop1Commission = (shop1Subtotal * shop1.commission_rate) / 100;
    const shop1Earnings = shop1Subtotal - shop1Commission;

    expect(shop1Subtotal).toBe(12897);
    expect(shop1Commission).toBeCloseTo(1289.7, 1);
    expect(shop1Earnings).toBeCloseTo(11607.3, 1);

    // Shop 2: 1299 * 5 = 6495
    const shop2Items = cartItems.filter((i) => i.shopId === shop2.id);
    const shop2Subtotal = shop2Items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const shop2Commission = (shop2Subtotal * shop2.commission_rate) / 100;
    const shop2Earnings = shop2Subtotal - shop2Commission;

    expect(shop2Subtotal).toBe(6495);
    expect(shop2Commission).toBeCloseTo(552.075, 1);
    expect(shop2Earnings).toBeCloseTo(5942.925, 1);
  });
});

describe("Promotional Coupon Engine", () => {
  const coupons = [
    {
      code: "TRIOFIRST10",
      discount_type: "percentage" as const,
      discount_value: 10,
      min_order_value: 1000,
      max_discount: 500,
    },
    {
      code: "B2BBULK50",
      discount_type: "fixed" as const,
      discount_value: 2500,
      min_order_value: 30000,
      max_discount: 2500,
    },
  ];

  it("should apply percentage coupon with max discount cap", () => {
    const coupon = coupons[0];
    const subtotal = 8000;
    const rawDiscount = (subtotal * coupon.discount_value) / 100; // 800
    const finalDiscount = Math.min(rawDiscount, coupon.max_discount); // capped at 500

    expect(finalDiscount).toBe(500);
  });

  it("should reject coupon when order subtotal is below minimum threshold", () => {
    const coupon = coupons[1]; // requires 30,000
    const subtotal = 15000;
    const isEligible = subtotal >= coupon.min_order_value;

    expect(isEligible).toBe(false);
  });
});

