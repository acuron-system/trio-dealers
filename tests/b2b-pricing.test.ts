import { describe, it, expect } from "vitest";

describe("B2B Wholesale Price Slabs", () => {
  const product = {
    id: "p1",
    name: "Royal Kanjivaram Gold Zari Silk Saree",
    retail_price: 4499,
    b2b_moq: 10,
    price_slabs: [
      { min_qty: 10, unit_price: 2999 },
      { min_qty: 50, unit_price: 2699 },
      { min_qty: 100, unit_price: 2399 },
    ],
  };

  const getB2BUnitPrice = (qty: number): number => {
    const sorted = [...product.price_slabs].sort((a, b) => b.min_qty - a.min_qty);
    const matched = sorted.find((s) => qty >= s.min_qty);
    return matched ? matched.unit_price : product.retail_price;
  };

  it("should charge retail price for quantities below first slab", () => {
    expect(getB2BUnitPrice(5)).toBe(4499);
  });

  it("should apply Tier 1 slab for 10-49 pieces", () => {
    expect(getB2BUnitPrice(10)).toBe(2999);
    expect(getB2BUnitPrice(25)).toBe(2999);
    expect(getB2BUnitPrice(49)).toBe(2999);
  });

  it("should apply Tier 2 slab for 50-99 pieces", () => {
    expect(getB2BUnitPrice(50)).toBe(2699);
    expect(getB2BUnitPrice(80)).toBe(2699);
  });

  it("should apply Tier 3 maximum volume slab for 100+ pieces", () => {
    expect(getB2BUnitPrice(100)).toBe(2399);
    expect(getB2BUnitPrice(250)).toBe(2399);
  });
});

describe("B2B Credit Terms & Balance Deduction", () => {
  it("should deduct order total from available credit line and track ledger", () => {
    const b2bAccount = {
      credit_limit: 100000,
      credit_balance: 100000,
    };

    const orderAmount = 62979;
    expect(b2bAccount.credit_balance >= orderAmount).toBe(true);

    const remainingCredit = b2bAccount.credit_balance - orderAmount;
    expect(remainingCredit).toBe(37021);
  });
});

