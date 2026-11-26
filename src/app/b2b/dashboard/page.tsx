"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchPublicProducts, fetchOrdersWithDetails } from "@/lib/db";
import { formatINR, formatDate, getOrderStatusBadge } from "@/lib/utils";
import { Order, Product } from "@/types/database";
import { BulkMatrixOrder } from "@/components/b2b/bulk-matrix-order";
import { maskTaxId } from "@/lib/security/crypto";
import {
  CreditCard,
  Package,
  Clock,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  Download,
  UploadCloud,
  FileCheck2,
  Search,
  BookmarkCheck,
  Users,
} from "lucide-react";

export default function B2BDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { addItem, setIsCartOpen } = useCart();

  const [activeTab, setActiveTab] = useState<
    "overview" | "quick_order" | "matrix" | "invoices"
  >("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [b2bOrders, setB2bOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [quickSku, setQuickSku] = useState("");
  const [quickQty, setQuickQty] = useState(10);
  const [quickMsg, setQuickMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [csvText, setCsvText] = useState("");

  const b2bAccount = user?.b2b_account;

  useEffect(() => {
    async function load() {
      if (!user || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [prods, orders] = await Promise.all([
        fetchPublicProducts(supabase),
        fetchOrdersWithDetails(supabase, user.id),
      ]);
      setProducts(prods);
      setB2bOrders(orders);
      setLoading(false);
    }
    if (!authLoading) {
      load();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading B2B Trade Desk...
      </div>
    );
  }

  if (!b2bAccount) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-5">
        <h1 className="text-2xl font-heading font-black text-ink">
          B2B Trade Account Required
        </h1>
        <p className="text-xs text-ink-secondary">
          Your profile is not linked to a registered wholesale business entity yet.
        </p>
        <Link
          href="/b2b/register"
          className="inline-block px-6 py-3 btn-gold-luxury text-xs rounded-xl"
        >
          Apply for B2B Trade Account
        </Link>
      </div>
    );
  }

  if (b2bAccount.verification_status !== "approved") {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/12 border-2 border-amber-500/40 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <Clock className="w-10 h-10 animate-pulse" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Verification Status: {b2bAccount.verification_status.toUpperCase()}
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            B2B Verification Pending
          </h1>
          <p className="text-ink-secondary text-sm max-w-md mx-auto leading-relaxed">
            Welcome, <strong className="text-ink">{b2bAccount.business_name}</strong>. Your GST trade credentials are under active review by Trio Dealers compliance.
          </p>
        </div>
        <div className="p-4 rounded-2xl luxury-card text-xs text-ink-secondary max-w-md mx-auto space-y-2 text-left">
          <p className="font-semibold text-ink">Application Record:</p>
          <p>• Entity: {b2bAccount.business_name}</p>
          <p>• GSTIN: {b2bAccount.gstin}</p>
          <p>• Verification: {b2bAccount.verification_status}</p>
        </div>
      </div>
    );
  }

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickMsg(null);

    const skuUpper = quickSku.trim().toUpperCase();
    let foundProduct: Product | null = null;
    let foundVariant = null;

    for (const p of products) {
      const v = p.variants?.find(
        (varItem) => varItem.sku?.toUpperCase() === skuUpper
      );
      if (v) {
        foundProduct = p;
        foundVariant = v;
        break;
      }
    }

    if (!foundProduct || !foundVariant) {
      setQuickMsg({
        type: "error",
        text: `SKU "${quickSku}" not found in catalog.`,
      });
      return;
    }

    if (quickQty < (foundProduct.b2b_moq || 10)) {
      setQuickMsg({
        type: "error",
        text: `Minimum wholesale order quantity for this item is ${
          foundProduct.b2b_moq || 10
        } pieces.`,
      });
      return;
    }

    addItem(foundProduct, foundVariant, quickQty);
    setQuickMsg({
      type: "success",
      text: `Added ${quickQty} pcs of ${foundProduct.name} (${foundVariant.color}) to trade bag!`,
    });
    setQuickSku("");
    setIsCartOpen(true);
  };

  const handleCsvBulkAdd = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    let addedCount = 0;

    for (const line of lines) {
      const [sku, qtyStr] = line.split(",").map((s) => s.trim());
      const qty = parseInt(qtyStr, 10);
      if (!sku || isNaN(qty) || qty <= 0) continue;

      for (const p of products) {
        const v = p.variants?.find(
          (varItem) => varItem.sku?.toUpperCase() === sku.toUpperCase()
        );
        if (v) {
          addItem(p, v, qty);
          addedCount += qty;
          break;
        }
      }
    }

    if (addedCount > 0) {
      setQuickMsg({
        type: "success",
        text: `Successfully processed CSV and added ${addedCount} total pieces!`,
      });
      setCsvText("");
      setIsCartOpen(true);
    } else {
      setQuickMsg({
        type: "error",
        text: "No matching SKUs found in uploaded CSV lines.",
      });
    }
  };

  const totalSpend = b2bOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const totalTaxCredit = b2bOrders.reduce(
    (s, o) => s + Number(o.tax_total || 0),
    0
  );
  const creditProgress =
    b2bAccount.credit_limit > 0
      ? Math.min(100, (b2bAccount.credit_balance / b2bAccount.credit_limit) * 100)
      : 0;

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
              Verified B2B Wholesale Partner
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              {b2bAccount.business_name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
              <span>
                GSTIN:{" "}
                <strong className="text-ink font-mono">
                  {maskTaxId(b2bAccount.gstin)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Buyer Terms:{" "}
                <strong className="text-gold-400 uppercase font-semibold">
                  {b2bAccount.payment_terms}
                </strong>
              </span>
              <span>•</span>
              <span>Contact: {user?.full_name}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/b2b/lists"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-2"
            >
              <BookmarkCheck className="w-4 h-4 text-gold-400" />
              Saved Lists &amp; Reorders
            </Link>
            <Link
              href="/b2b/team"
              className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink text-xs font-bold transition flex items-center gap-2"
            >
              <Users className="w-4 h-4 text-gold-400" />
              Buyer Team
            </Link>
            <Link
              href="/b2b/rfq"
              className="px-4 py-2.5 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-gold-400 text-xs font-bold transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Custom RFQ Desk
            </Link>
            <Link
              href="/catalog"
              className="px-4 py-2.5 rounded-xl btn-gold-luxury text-xs font-bold transition flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse Wholesale Catalog
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Total Credit Line</span>
              <CreditCard className="w-4 h-4 text-gold-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink">
              {formatINR(b2bAccount.credit_limit)}
            </p>
            <p className="text-[10px] text-ink-muted">
              Sanctioned trade credit by Trio Dealers
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card border border-gold-500/35 space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span className="text-gold-400 font-semibold">
                Available Credit
              </span>
              <CheckCircle2 className="w-4 h-4 text-gold-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-gold-400">
              {formatINR(b2bAccount.credit_balance)}
            </p>
            <div className="w-full bg-surface-input h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gold-500 h-full rounded-full"
                style={{ width: `${creditProgress}%` }}
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Payment Terms</span>
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink uppercase">
              {b2bAccount.payment_terms}
            </p>
            <p className="text-[10px] text-ink-muted">
              Configured by Trio Dealers Admin
            </p>
          </div>

          <div className="p-5 rounded-2xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-ink-secondary text-xs">
              <span>Total Volume Spend</span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink">
              {formatINR(totalSpend)}
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
              GST Input Tax Credit: {formatINR(totalTaxCredit)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-edge pb-2 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Consignment Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quick_order")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "quick_order"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Quick SKU & CSV Ordering
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "matrix"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Size × Color Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap ${
              activeTab === "invoices"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            GST Tax Invoices
          </button>
        </div>

        {activeTab === "matrix" && <BulkMatrixOrder products={products} />}

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <Package className="w-5 h-5 text-gold-400" /> Wholesale Consignments & Split Shipments
              </h2>
              <span className="text-xs text-ink-secondary">
                {b2bOrders.length} orders
              </span>
            </div>

            {b2bOrders.length === 0 ? (
              <div className="p-10 rounded-3xl luxury-card text-center space-y-3 text-xs text-ink-muted">
                <p>No wholesale orders placed yet.</p>
                <Link
                  href="/catalog"
                  className="inline-block px-5 py-2.5 btn-gold-luxury rounded-xl text-xs"
                >
                  Browse Wholesale Catalog
                </Link>
              </div>
            ) : (
              b2bOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-6 rounded-3xl luxury-card hover:border-gold-500/40 transition space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-mono font-bold text-gold-400">
                          {ord.order_no}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          {ord.payment_method.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary">
                        Placed: {formatDate(ord.created_at)} • Dispatched to:{" "}
                        {ord.address_snapshot.city}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-ink-secondary">
                        Total B2B Invoice
                      </p>
                      <p className="text-lg font-bold font-mono text-ink">
                        {formatINR(ord.total_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                      Fulfillment Parcels:
                    </p>
                    {ord.sub_orders?.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl bg-surface-subtle border border-edge flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">
                              {sub.shop?.shop_name || "Mill Store"}
                            </span>
                            <span className="font-mono text-[10px] text-ink-muted">
                              ({sub.sub_order_no})
                            </span>
                          </div>
                          <p className="text-ink-secondary text-[11px]">
                            {sub.items
                              ?.map((it) => `${it.quantity}x ${it.product_name}`)
                              .join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getOrderStatusBadge(
                              sub.status
                            )}`}
                          >
                            {sub.status.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono font-bold text-ink">
                            {formatINR(sub.total)}
                          </span>
                          <Link
                            href={`/orders/${ord.order_no}`}
                            className="p-1.5 rounded-lg bg-surface border border-edge hover:bg-gold-500 hover:text-black text-ink transition"
                            title="View Consignment Timeline"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "quick_order" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-3xl luxury-card border border-gold-500/35 space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                  <Search className="w-4 h-4 text-gold-400" /> Quick Add by SKU
                </h3>
                <p className="text-xs text-ink-secondary">
                  Directly add bulk lots using catalogue code without browsing pages.
                </p>
              </div>

              {quickMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    quickMsg.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300"
                  }`}
                >
                  {quickMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{quickMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleQuickAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Item SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSku}
                    onChange={(e) => setQuickSku(e.target.value)}
                    placeholder="e.g. TD-SK-001-RED or TD-CT-003-WHT"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs font-mono uppercase focus:border-gold-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Quantity (Wholesale MOQ applies)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quickQty}
                    onChange={(e) =>
                      setQuickQty(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono focus:border-gold-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to Wholesale Order
                </button>
              </form>
            </div>

            <div className="p-6 rounded-3xl luxury-card space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-gold-400" /> Bulk CSV Order Input
                </h3>
                <p className="text-xs text-ink-secondary">
                  Paste lines in format:{" "}
                  <code className="text-gold-400 font-mono">SKU, QUANTITY</code>
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="TD-SK-001-RED, 20&#10;TD-CT-003-WHT, 50"
                  className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono focus:border-gold-500 outline-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleCsvBulkAdd}
                className="w-full py-3 rounded-xl bg-surface-subtle hover:border-gold-500 text-ink font-bold text-xs uppercase tracking-wider transition border border-edge flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4 text-gold-400" />
                Batch Import Lines
              </button>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="p-6 rounded-3xl luxury-card space-y-4">
            <div className="flex items-center justify-between border-b border-edge pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-gold-400" /> B2B GST Tax Invoices
                </h3>
                <p className="text-xs text-ink-secondary">
                  Official GST e-invoices with Buyer GSTIN ({b2bAccount.gstin}) and HSN breakdown for ITC claiming.
                </p>
              </div>
            </div>

            {b2bOrders.length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">
                No tax invoices issued yet.
              </p>
            ) : (
              <div className="divide-y divide-edge">
                {b2bOrders.flatMap((ord) =>
                  (ord.sub_orders || []).map((sub) => (
                    <div
                      key={sub.id}
                      className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-ink flex items-center gap-2">
                          <span>{sub.invoice_no || sub.sub_order_no}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                            GST {formatINR(sub.tax_total)}
                          </span>
                        </p>
                        <p className="text-ink-secondary text-[11px]">
                          Order: {ord.order_no} • Mill:{" "}
                          {sub.shop?.shop_name || "Mill Store"} • Date:{" "}
                          {formatDate(ord.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm text-gold-400">
                          {formatINR(sub.total)}
                        </span>
                        <Link
                          href={`/orders/${ord.order_no}`}
                          className="px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-gold-500 hover:text-black border border-edge text-ink text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Print Invoice
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
