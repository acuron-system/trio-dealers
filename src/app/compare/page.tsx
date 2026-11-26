"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Product } from "@/types/database";
import { formatINR } from "@/lib/utils";
import { Scale, Trash2, ArrowRight } from "lucide-react";

export default function ComparePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompared() {
      let ids: string[] = [];
      try {
        ids = JSON.parse(localStorage.getItem("trio_compare") || "[]");
      } catch {
        ids = [];
      }

      if (!isSupabaseConfigured() || ids.length === 0) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select(
          "*, shop:shops(shop_name, slug), category:categories(name), brand:brands(name), price_slabs(*), variants:product_variants(*)"
        )
        .in("id", ids.slice(0, 4))
        .eq("approval_status", "approved")
        .eq("is_active", true);

      setProducts((data || []) as Product[]);
      setLoading(false);
    }

    loadCompared();
  }, []);

  const removeCompare = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    try {
      const ids: string[] = JSON.parse(localStorage.getItem("trio_compare") || "[]");
      localStorage.setItem(
        "trio_compare",
        JSON.stringify(ids.filter((x) => x !== id))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-canvas py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/35 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5" /> Side-by-Side Comparison
          </span>
          <h1 className="text-3xl font-heading font-black text-ink mt-2">
            Compare Fabrics &amp; Trade Rates
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Compare up to 4 products across fabric composition, HSN code, GST rate, B2B MOQ, and stock.
          </p>
        </div>

        {loading ? (
          <div className="luxury-card rounded-2xl p-8 text-center text-xs text-ink-muted">
            Loading comparison sheet...
          </div>
        ) : products.length === 0 ? (
          <div className="luxury-card rounded-3xl p-10 text-center space-y-4">
            <Scale className="w-10 h-10 text-gold-400 mx-auto" />
            <h2 className="text-lg font-heading font-bold text-ink">
              No Products Selected for Comparison
            </h2>
            <p className="text-xs text-ink-muted">
              Open any product page and click &ldquo;Compare&rdquo; to inspect weave specs side-by-side.
            </p>
            <Link
              href="/catalog"
              className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
            >
              Browse Catalog <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="luxury-card rounded-3xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-edge bg-surface-subtle">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-ink-muted w-44">
                    Specification
                  </th>
                  {products.map((p) => (
                    <th key={p.id} className="p-4 min-w-[220px]">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/product/${p.slug}`}
                          className="font-bold text-sm text-ink hover:text-gold-400"
                        >
                          {p.name}
                        </Link>
                        <button
                          onClick={() => removeCompare(p.id)}
                          aria-label="Remove from compare"
                          className="text-ink-muted hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">Seller / Mill</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 text-ink">
                      {p.shop?.shop_name || "House Stock"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">Retail Price</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 font-mono font-bold text-gold-400">
                      {formatINR(p.retail_price)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">Fabric</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 text-ink">
                      {p.fabric || "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">HSN / GST</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 font-mono text-ink">
                      {p.hsn_code || "5007"} ({p.gst_rate ?? 5}%)
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">B2B MOQ</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 font-mono text-ink">
                      {p.sell_b2b ? `${p.b2b_moq || 1} units` : "Retail Only"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink-muted">Total Variants Stock</td>
                  {products.map((p) => {
                    const qty = (p.variants || []).reduce(
                      (s, v) => s + Number(v.stock_qty || 0),
                      0
                    );
                    return (
                      <td key={p.id} className="p-4 font-mono text-ink">
                        {qty} units
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

