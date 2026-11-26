"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDate, formatINR } from "@/lib/utils";
import { Printer, ArrowLeft } from "lucide-react";

export default function SellerPackingSlipPage() {
  const params = useParams();
  const subOrderId = params?.id as string;
  const [sub, setSub] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!subOrderId || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("sub_orders")
        .select(
          `
          *,
          shop:shops(*),
          parent_order:orders(order_no, created_at, payment_method, payment_status, address_snapshot),
          items:order_items(*)
        `
        )
        .eq("id", subOrderId)
        .single();
      setSub(data || null);
      setLoading(false);
    }
    load();
  }, [subOrderId]);

  if (loading) {
    return <div className="p-12 text-center text-xs text-ink-muted">Loading slip...</div>;
  }

  if (!sub) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-bold text-ink">Sub-order packing slip not found.</p>
        <Link href="/shop-dashboard" className="text-xs text-gold-400 hover:underline">
          ← Back to Seller Dashboard
        </Link>
      </div>
    );
  }

  const addr = sub.parent_order?.address_snapshot || {};

  return (
    <div className="min-h-screen bg-canvas py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="no-print flex items-center justify-between">
          <Link
            href="/shop-dashboard"
            className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Seller Dashboard
          </Link>
          <button
            onClick={() => window.print()}
            className="btn-gold-luxury px-4 py-2 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print GST Slip / PDF
          </button>
        </div>

        <div className="bg-white text-black rounded-2xl p-8 border border-neutral-300 space-y-6 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
            <div>
              <h1 className="text-xl font-extrabold tracking-wide">
                TAX INVOICE &amp; PACKING SLIP
              </h1>
              <p className="font-semibold text-neutral-700 mt-1">
                Dispatch Mill: {sub.shop?.shop_name || "Trio Dealers Seller"}
              </p>
              <p className="text-neutral-600">
                {sub.shop?.address_line1}, {sub.shop?.city}, {sub.shop?.state}{" "}
                {sub.shop?.pincode}
              </p>
              {sub.shop?.gstin && (
                <p className="font-mono font-bold mt-1">Seller GSTIN: {sub.shop.gstin}</p>
              )}
            </div>

            <div className="text-right font-mono space-y-1">
              <p>
                <strong>Invoice No:</strong> {sub.invoice_no || sub.sub_order_no}
              </p>
              <p>
                <strong>Sub-Order:</strong> {sub.sub_order_no}
              </p>
              <p>
                <strong>Parent Order:</strong> {sub.parent_order?.order_no}
              </p>
              <p>
                <strong>Date:</strong> {formatDate(sub.created_at)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <div>
              <p className="font-bold uppercase text-[10px] text-neutral-500">
                Bill / Ship To
              </p>
              <p className="font-bold text-sm mt-0.5">{addr.name}</p>
              <p>{addr.line1}</p>
              <p>
                {addr.city}, {addr.state} – {addr.pincode}
              </p>
              <p>Phone: {addr.phone}</p>
              {addr.buyer_gstin && (
                <p className="font-mono font-bold mt-1">Buyer GSTIN: {addr.buyer_gstin}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="font-bold uppercase text-[10px] text-neutral-500">
                Payment Terms
              </p>
              <p className="uppercase font-bold mt-0.5">
                {sub.parent_order?.payment_method} ({sub.parent_order?.payment_status})
              </p>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-300">
                <th className="py-2">Product / Variant</th>
                <th className="py-2">HSN</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">GST (CGST/SGST/IGST)</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(sub.items || []).map((it: any) => {
                const tax =
                  Number(it.cgst || 0) + Number(it.sgst || 0) + Number(it.igst || 0);
                return (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <p className="font-semibold">{it.product_name}</p>
                      <p className="text-[11px] text-neutral-600">{it.variant_info}</p>
                    </td>
                    <td className="py-2.5 font-mono">{it.hsn_code || "5007"}</td>
                    <td className="py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatINR(it.unit_price)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {it.igst > 0
                        ? `IGST ${formatINR(it.igst)}`
                        : `${formatINR(it.cgst)} + ${formatINR(it.sgst)}`}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      {formatINR(Number(it.line_total) + tax)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-neutral-300 pt-4 flex flex-col sm:flex-row justify-between gap-4">
            <div className="space-y-1 text-neutral-600">
              <p>
                <strong>Marketplace Commission:</strong>{" "}
                {formatINR(sub.commission_amount || 0)}
              </p>
              <p>
                <strong>Seller Net Settlement:</strong>{" "}
                {formatINR(sub.shop_earnings || 0)}
              </p>
            </div>
            <div className="text-right space-y-1 font-mono">
              <p>Subtotal: {formatINR(sub.subtotal)}</p>
              <p>GST Total: {formatINR(sub.tax_total)}</p>
              <p>Shipping: {formatINR(sub.shipping_fee)}</p>
              <p className="text-base font-extrabold pt-1 border-t border-neutral-300">
                Invoice Total: {formatINR(sub.total)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

