"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrderByNo } from "@/lib/db";
import { Order } from "@/types/database";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { formatINR, formatDate, getOrderStatusBadge } from "@/lib/utils";
import {
  Printer,
  Truck,
  ArrowLeft,
  Calendar,
  CreditCard,
  MapPin,
  Phone,
  Store,
  Package,
} from "lucide-react";

export default function OrderDetailPage() {
  const params = useParams();
  const orderNo = params?.orderNo as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      if (!orderNo || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const fetched = await fetchOrderByNo(supabase, orderNo);
      setOrder(fetched);
      setLoading(false);
    }
    loadOrder();
  }, [orderNo]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <p className="text-ink-muted text-sm">Loading consignment details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center space-y-4">
        <h2 className="text-2xl font-bold text-ink font-heading">
          Order Not Found
        </h2>
        <p className="text-ink-secondary text-xs">
          No order matching reference{" "}
          <strong className="text-gold-400 font-mono">{orderNo}</strong> was located.
        </p>
        <Link
          href="/account"
          className="inline-block px-5 py-2.5 btn-gold-luxury text-xs rounded-xl"
        >
          View My Orders
        </Link>
      </div>
    );
  }

  const subOrders = order.sub_orders || [];
  const allItems =
    subOrders.length > 0
      ? subOrders.flatMap((s) => s.items || [])
      : (order as any).items || [];

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <Link
              href="/catalog"
              className="text-xs text-ink-secondary hover:text-gold-400 flex items-center gap-1.5 transition mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
                Consignment {order.order_no}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getOrderStatusBadge(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5" />
              Placed: {formatDate(order.created_at)} • Type:{" "}
              {order.order_type.toUpperCase()}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle text-ink border border-edge font-semibold text-xs transition flex items-center gap-2 self-start sm:self-auto"
          >
            <Printer className="w-4 h-4 text-gold-400" />
            Print / Save GST Invoice
          </button>
        </div>

        {/* Visual Tracking Stepper */}
        <div className="p-6 rounded-3xl luxury-card border border-gold-500/30 no-print space-y-4">
          <h2 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
            <Truck className="w-4 h-4 text-gold-400" />
            Shipment Progress Timeline
          </h2>
          <StatusTimeline currentStatus={order.status} />
        </div>

        {/* Multi-Vendor Sub-Orders */}
        {subOrders.length > 0 && (
          <div className="space-y-4 no-print">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <Package className="w-4 h-4 text-gold-400" />
              Direct Mill Parcels ({subOrders.length} Shipments)
            </h2>

            <div className="space-y-4">
              {subOrders.map((sub) => (
                <div
                  key={sub.id}
                  className="p-6 rounded-3xl luxury-card hover:border-gold-500/35 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-gold-400" />
                          {sub.shop?.shop_name || "Surat Mill Depot"}
                        </span>
                        <span className="text-ink-muted font-mono text-[11px]">
                          ({sub.sub_order_no})
                        </span>
                      </div>
                      {sub.invoice_no && (
                        <p className="text-[10px] text-ink-secondary font-mono">
                          Invoice: {sub.invoice_no}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getOrderStatusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono font-bold text-ink text-sm">
                        {formatINR(sub.total)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sub.items?.map((it) => (
                      <div
                        key={it.id}
                        className="p-3 rounded-xl bg-surface-subtle flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-ink">
                            {it.product_name}
                          </p>
                          <p className="text-ink-muted text-[11px]">
                            {it.variant_info} • HSN: {it.hsn_code}
                          </p>
                        </div>
                        <div className="font-mono text-ink-secondary">
                          {it.quantity} x {formatINR(it.unit_price)} ={" "}
                          <strong className="text-ink">
                            {formatINR(it.line_total)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRINTABLE INVOICE / ORDER SUMMARY CARD */}
        <div className="p-6 sm:p-8 rounded-3xl luxury-card space-y-8 print:border-none print:p-0 print:bg-white print:text-black">
          <div className="flex items-start justify-between border-b border-edge print:border-black/20 pb-6">
            <div className="space-y-1">
              <span className="font-royal font-extrabold text-xl tracking-wider text-gold-gradient print:text-black block">
                TRIO DEALERS
              </span>
              <p className="text-xs text-ink-secondary print:text-zinc-600">
                Retail & Wholesale Cloth Merchants Platform
              </p>
              <p className="text-xs text-ink-muted print:text-zinc-500 font-mono">
                Mill Depots: Ring Road, Surat, Gujarat • GSTIN: 24AABCT1234F1Z8
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <div className="text-base font-bold text-ink print:text-black font-mono">
                TAX INVOICE
              </div>
              <div className="text-xs text-gold-400 print:text-black font-mono">
                #{order.order_no}
              </div>
              <div className="text-xs text-ink-muted print:text-zinc-500 font-mono">
                Date: {formatDate(order.created_at)}
              </div>
            </div>
          </div>

          {/* Customer & Shipping Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge print:bg-zinc-50 print:border-zinc-300 space-y-1.5">
              <h4 className="font-bold text-gold-400 print:text-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Consignee / Delivery Address:
              </h4>
              <p className="font-semibold text-ink print:text-black text-sm">
                {order.address_snapshot.name || "Customer"}
              </p>
              <p className="text-ink-secondary print:text-zinc-700">
                {order.address_snapshot.line1}
                {order.address_snapshot.line2 &&
                  `, ${order.address_snapshot.line2}`}
              </p>
              <p className="text-ink-secondary print:text-zinc-700">
                {order.address_snapshot.city}, {order.address_snapshot.state} -{" "}
                {order.address_snapshot.pincode}
              </p>
              {order.address_snapshot.buyer_gstin && (
                <p className="text-gold-400 print:text-black font-mono text-[11px] pt-1">
                  Buyer GSTIN: {order.address_snapshot.buyer_gstin}
                </p>
              )}
              {order.address_snapshot.phone && (
                <p className="text-ink-muted print:text-zinc-600 flex items-center gap-1 pt-1">
                  <Phone className="w-3 h-3" /> {order.address_snapshot.phone}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-edge print:bg-zinc-50 print:border-zinc-300 space-y-1.5">
              <h4 className="font-bold text-gold-400 print:text-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment & Dispatch Terms:
              </h4>
              <p className="text-ink-secondary print:text-zinc-700">
                <span className="text-ink-muted print:text-zinc-500">
                  Method:
                </span>{" "}
                <span className="font-semibold text-ink print:text-black uppercase">
                  {order.payment_method.replace(/_/g, " ")}
                </span>
              </p>
              <p className="text-ink-secondary print:text-zinc-700">
                <span className="text-ink-muted print:text-zinc-500">
                  Payment Status:
                </span>{" "}
                <span
                  className={`font-semibold capitalize ${
                    order.payment_status === "paid"
                      ? "text-emerald-700 dark:text-emerald-400 print:text-emerald-700"
                      : "text-amber-700 dark:text-amber-400 print:text-amber-700"
                  }`}
                >
                  {order.payment_status}
                </span>
              </p>
              <p className="text-ink-secondary print:text-zinc-700">
                <span className="text-ink-muted print:text-zinc-500">
                  Order Class:
                </span>{" "}
                <span className="capitalize">{order.order_type} Order</span>
              </p>
              <p className="text-ink-secondary print:text-zinc-700">
                <span className="text-ink-muted print:text-zinc-500">
                  Logistics Status:
                </span>{" "}
                <span className="font-semibold text-gold-400 print:text-black">
                  {subOrders.some((s) => s.transporter_id)
                    ? "Assigned Dispatch Carrier"
                    : "Pending Dispatch Assignment"}
                </span>
              </p>
            </div>
          </div>

          {/* Order Item Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-edge print:border-zinc-400 text-ink-muted print:text-zinc-600 uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 font-semibold">Item & Fabric Detail</th>
                  <th className="py-3 font-semibold text-center">HSN</th>
                  <th className="py-3 font-semibold text-center">Unit Price</th>
                  <th className="py-3 font-semibold text-center">Qty</th>
                  <th className="py-3 font-semibold text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge print:divide-zinc-200">
                {allItems.map((it: any) => (
                  <tr
                    key={it.id}
                    className="text-ink-secondary print:text-zinc-800"
                  >
                    <td className="py-4 font-medium">
                      <p className="text-ink print:text-black font-semibold text-sm">
                        {it.product_name}
                      </p>
                      {it.variant_info && (
                        <p className="text-[11px] text-ink-muted print:text-zinc-500 mt-0.5">
                          {it.variant_info}
                        </p>
                      )}
                    </td>
                    <td className="py-4 text-center font-mono text-[11px]">
                      {it.hsn_code || "5007"}
                    </td>
                    <td className="py-4 text-center font-mono">
                      {formatINR(it.unit_price || it.price)}
                    </td>
                    <td className="py-4 text-center font-semibold">
                      {it.quantity}
                    </td>
                    <td className="py-4 text-right font-mono font-bold text-ink print:text-black">
                      {formatINR(it.line_total || it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="border-t border-edge print:border-zinc-300 pt-4 flex flex-col items-end space-y-1.5 text-xs text-ink-secondary print:text-zinc-700">
            <div className="w-64 flex justify-between">
              <span>Subtotal:</span>
              <span className="text-ink print:text-black font-mono">
                {formatINR(order.subtotal)}
              </span>
            </div>
            <div className="w-64 flex justify-between">
              <span>Insured Freight:</span>
              <span className="text-ink print:text-black font-mono">
                {order.shipping_fee === 0 || (order as any).shipping === 0
                  ? "FREE"
                  : formatINR(order.shipping_fee || 0)}
              </span>
            </div>
            <div className="w-64 flex justify-between">
              <span>GST (CGST + SGST):</span>
              <span className="text-ink print:text-black font-mono">
                {formatINR(order.tax_total || 0)}
              </span>
            </div>
            <div className="w-64 pt-2 border-t border-edge print:border-zinc-400 flex justify-between text-base font-bold text-ink print:text-black">
              <span>Total Payable:</span>
              <span className="text-gold-400 print:text-black font-heading text-lg font-mono">
                {formatINR(order.total_amount || order.total || 0)}
              </span>
            </div>
          </div>

          {/* Invoice Footer */}
          <div className="border-t border-edge print:border-zinc-300 pt-6 text-[11px] text-ink-muted print:text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              Trio Dealers • Surat • Retail & Wholesale Cloth Merchants
            </span>
            <span>
              Authorized Computer-Generated Invoice • Subject to Surat Jurisdiction
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
