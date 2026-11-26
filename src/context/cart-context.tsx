"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Product, ProductVariant, Shop, Coupon } from "@/types/database";
import { useAuth } from "./auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface CartItemEntry {
  id: string; // unique item id in cart (e.g. `${product.id}-${variant.id}`)
  product: Product;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  isWholesale: boolean;
}

export interface ShopCartGroup {
  shopId: string;
  shopName: string;
  shopSlug?: string;
  shop?: Shop;
  items: CartItemEntry[];
  subtotal: number;
  taxTotal: number;
  shippingFee: number;
  total: number;
  commissionEstimate: number;
}

interface CartContextType {
  items: CartItemEntry[];
  wishlistIds: string[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  addBulkItems: (product: Product, entries: Array<{ variant: ProductVariant; quantity: number }>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  subtotal: number;
  shipping: number;
  taxTotal: number;
  discountAmount: number;
  total: number;
  totalItems: number;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  getShopGroups: () => ShopCartGroup[];
  unavailableNotices: string[];
  dismissUnavailableNotices: () => void;
  refreshCartAvailability: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemEntry[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [unavailableNotices, setUnavailableNotices] = useState<string[]>([]);
  const { user, role } = useAuth();

  const isB2BOrShop = role === "b2b" || role === "shop";

  const refreshCartAvailability = async (candidateItems?: CartItemEntry[]) => {
    if (!isSupabaseConfigured()) return;
    const list = candidateItems || items;
    if (!list || list.length === 0) return;

    const productIds = Array.from(new Set(list.map((i) => i.product.id)));
    try {
      const res = await fetch("/api/products/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const deadIds = new Set<string>(data.unavailableIds || []);
      if (deadIds.size === 0) return;

      const removedNames = Array.from(
        new Set(list.filter((it) => deadIds.has(it.product.id)).map((it) => it.product.name))
      );

      setItems((prev) => prev.filter((it) => !deadIds.has(it.product.id)));
      setUnavailableNotices((prev) => Array.from(new Set([...prev, ...removedNames])));
    } catch {
      // Ignore transient network errors
    }
  };

  // Load persisted cart & wishlist on mount and verify availability
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("trio_cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartItemEntry[];
        setItems(parsed);
        if (parsed.length > 0) {
          refreshCartAvailability(parsed);
        }
      }
      const savedWishlist = localStorage.getItem("trio_wishlist");
      if (savedWishlist) {
        setWishlistIds(JSON.parse(savedWishlist));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isCartOpen && items.length > 0) {
      refreshCartAvailability(items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCartOpen]);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("trio_cart", JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem("trio_wishlist", JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds]);

  // Calculate pricing based on role and tier
  const calculateUnitPrice = (product: Product, qty: number): number => {
    if (isB2BOrShop) {
      // Check price_slabs first
      if (product.price_slabs && product.price_slabs.length > 0) {
        const sortedSlabs = [...product.price_slabs].sort((a, b) => b.min_qty - a.min_qty);
        const matched = sortedSlabs.find((s) => qty >= s.min_qty);
        if (matched) return matched.unit_price;
        // lowest slab fallback
        return sortedSlabs[sortedSlabs.length - 1].unit_price;
      }

      // Check legacy wholesale_prices fallback if present
      const anyProd = product as any;
      if (anyProd.wholesale_prices && anyProd.wholesale_prices.length > 0) {
        const sortedTiers = [...anyProd.wholesale_prices].sort((a: any, b: any) => b.min_qty - a.min_qty);
        const matchedTier = sortedTiers.find((t: any) => qty >= t.min_qty);
        if (matchedTier) return matchedTier.price;
        return sortedTiers[sortedTiers.length - 1].price;
      }
    }
    return product.retail_price;
  };

  const addItem = (product: Product, variant: ProductVariant, quantity: number = 1) => {
    setItems((prevItems) => {
      const itemId = `${product.id}-${variant.id}`;
      const existingIndex = prevItems.findIndex((it) => it.id === itemId);

      if (existingIndex > -1) {
        const existing = prevItems[existingIndex];
        const newQty = existing.quantity + quantity;
        const newUnitPrice = calculateUnitPrice(product, newQty);

        const updated = [...prevItems];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          unitPrice: newUnitPrice,
          isWholesale: isB2BOrShop,
        };
        return updated;
      } else {
        const unitPrice = calculateUnitPrice(product, quantity);
        return [
          ...prevItems,
          {
            id: itemId,
            product,
            variant,
            quantity,
            unitPrice,
            isWholesale: isB2BOrShop,
          },
        ];
      }
    });

    setIsCartOpen(true);
  };

  const addBulkItems = (product: Product, entries: Array<{ variant: ProductVariant; quantity: number }>) => {
    if (!entries || entries.length === 0) return;

    setItems((prevItems) => {
      let updated = [...prevItems];
      const totalBatchQty = entries.reduce((s, e) => s + e.quantity, 0);

      for (const entry of entries) {
        if (entry.quantity <= 0) continue;
        const itemId = `${product.id}-${entry.variant.id}`;
        const existingIndex = updated.findIndex((it) => it.id === itemId);
        const existingQty = existingIndex > -1 ? updated[existingIndex].quantity : 0;
        const finalItemQty = existingQty + entry.quantity;

        // Use totalBatchQty or finalItemQty for slab calculation
        const unitPrice = calculateUnitPrice(product, Math.max(totalBatchQty, finalItemQty));

        if (existingIndex > -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: finalItemQty,
            unitPrice,
            isWholesale: isB2BOrShop,
          };
        } else {
          updated.push({
            id: itemId,
            product,
            variant: entry.variant,
            quantity: entry.quantity,
            unitPrice,
            isWholesale: isB2BOrShop,
          });
        }
      }
      return updated;
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const newUnitPrice = calculateUnitPrice(item.product, quantity);
          return {
            ...item,
            quantity,
            unitPrice: newUnitPrice,
          };
        }
        return item;
      })
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((it) => it.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  // Merge guest cart into authenticated user DB cart on login
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    let active = true;
    async function syncCartWithDb() {
      try {
        const guestItems = items.map((it) => ({
          productId: it.product.id,
          variantId: it.variant.id,
          quantity: it.quantity,
        }));
        const res = await fetch("/api/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: guestItems }),
        });
        if (!res.ok || !active) return;
        const payload = await res.json();
        if (Array.isArray(payload?.items) && payload.items.length > 0 && active) {
          const merged: CartItemEntry[] = payload.items.map((row: any) => {
            const qty = Number(row.quantity || 1);
            const unitPrice = calculateUnitPrice(row.product, qty);
            return {
              id: `${row.product.id}-${row.variant.id}`,
              product: row.product,
              variant: row.variant,
              quantity: qty,
              unitPrice,
              isWholesale: isB2BOrShop,
            };
          });
          setItems(merged);
        }
      } catch {
        // Keep local cart safely if offline or unavailable
      }
    }

    syncCartWithDb();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, message: "Database connection required to verify coupons." };
    }

    const cleanCode = code.trim().toUpperCase();
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, subtotal }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.valid || !payload.coupon) {
        return {
          success: false,
          message: payload?.message || "Invalid or expired promotional coupon code.",
        };
      }
      setAppliedCoupon(payload.coupon as Coupon);
      return {
        success: true,
        message: payload.message || `Coupon ${cleanCode} applied successfully!`,
      };
    } catch {
      return { success: false, message: "Unable to validate coupon right now." };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Group items by Shop/Seller
  const getShopGroups = (): ShopCartGroup[] => {
    const map = new Map<string, ShopCartGroup>();

    for (const item of items) {
      const shopId = item.product.shop_id || item.product.shop?.id || "trio-central-depot";
      const shopName = item.product.shop?.shop_name || "Trio Dealers Central Depot";
      const shopSlug = item.product.shop?.slug;
      const commissionRate = item.product.shop?.commission_rate || 10.0;

      if (!map.has(shopId)) {
        map.set(shopId, {
          shopId,
          shopName,
          shopSlug,
          shop: item.product.shop,
          items: [],
          subtotal: 0,
          taxTotal: 0,
          shippingFee: 0,
          total: 0,
          commissionEstimate: 0,
        });
      }

      const group = map.get(shopId)!;
      group.items.push(item);
      const lineTotal = item.unitPrice * item.quantity;
      group.subtotal += lineTotal;

      // GST tax computation per product rate (default 5%)
      const gstRate = item.product.gst_rate || 5.0;
      const itemTax = (lineTotal * gstRate) / 100;
      group.taxTotal += itemTax;
    }

    // Compute totals per shop
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.shippingFee = isB2BOrShop || g.subtotal > 1999 ? 0 : 100;
      g.total = g.subtotal + g.taxTotal + g.shippingFee;
      const commissionRate = g.shop?.commission_rate || 10.0;
      g.commissionEstimate = (g.subtotal * commissionRate) / 100;
    }

    return groups;
  };

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Total GST calculation
  const taxTotal = items.reduce((sum, item) => {
    const rate = item.product.gst_rate || 5.0;
    return sum + (item.unitPrice * item.quantity * rate) / 100;
  }, 0);

  // Free delivery for wholesale or orders above ₹1,999; ₹150 otherwise
  const shipping = subtotal > 1999 || isB2BOrShop || items.length === 0 ? 0 : 150;

  // Coupon discount computation
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === "percentage") {
      discountAmount = Math.min((subtotal * appliedCoupon.discount_value) / 100, appliedCoupon.max_discount);
    } else {
      discountAmount = Math.min(appliedCoupon.discount_value, subtotal);
    }
  }

  const total = Math.max(0, subtotal + taxTotal + shipping - discountAmount);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const dismissUnavailableNotices = () => {
    setUnavailableNotices([]);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        wishlistIds,
        isCartOpen,
        setIsCartOpen,
        addItem,
        addBulkItems,
        updateQuantity,
        removeItem,
        clearCart,
        toggleWishlist,
        isInWishlist,
        subtotal,
        shipping,
        taxTotal,
        discountAmount,
        total,
        totalItems,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        getShopGroups,
        unavailableNotices,
        dismissUnavailableNotices,
        refreshCartAvailability: () => refreshCartAvailability(),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
