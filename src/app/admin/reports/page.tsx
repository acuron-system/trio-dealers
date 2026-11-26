"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrdersWithDetails } from "@/lib/db";
import { Order } from "@/types/database";
import { formatINR, formatDate } from "@/lib/utils";
import { BarChart3, Download, TrendingUp } from "lucide-react";

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "weekly"
  );

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const rows = await fetchOrdersWithDetails(supabase);
      setOrders(rows);
      setLoading(false);
    }
    load();
  }, []);

  const totalRevenue = orders.reduce(
    (acc, curr) => acc + Number(curr.total_amount || curr.total || 0),
    0
  );
  const wholesaleRevenue = orders
    .filter((o) => o.order_type === "b2b" || o.order_type === "wholesale")
    .reduce(
      (acc, curr) => acc + Number(curr.total_amount || curr.total || 0),
      0
    );
  const retailRevenue = orders
    .filter((o) => o.order_type === "retail")
    .reduce(
      (acc, curr) => acc + Number(curr.total_amount || curr.total || 0),
      0
    );

  const groupedRows = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        count: number;
        retail: number;
        wholesale: number;
        total: number;
      }
    >();

    for (const o of orders) {
      const date = new Date(o.created_at);
      let key = "";
      if (timeframe === "daily") {
        key = date.toISOString().split("T")[0];
      } else if (timeframe === "monthly") {
        key = `${date.toLocaleString("en-IN", {
          month: "short",
        })} ${date.getFullYear()}`;
      } else {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `Week of ${startOfWeek.toISOString().split("T")[0]}`;
      }

      if (!groups.has(key)) {
        groups.set(key, {
          label: key,
          count: 0,
          retail: 0,
          wholesale: 0,
          total: 0,
        });
      }
      const entry = groups.get(key)!;
      const amt = Number(o.total_amount || o.total || 0);
      entry.count += 1;
      if (o.order_type === "b2b" || o.order_type === "wholesale") {
        entry.wholesale += amt;
      } else {
        entry.retail += amt;
      }
      entry.total += amt;
    }

    return Array.from(groups.values());
  }, [orders, timeframe]);

  const handleExportCSV = () => {
    const headers = [
      "Order Number",
      "Order Type",
      "Customer / Shop Name",
      "City",
      "State",
      "Date",
      "Payment Mode",
      "Payment Status",
      "Status",
      "Subtotal (INR)",
      "Shipping (INR)",
      "Total Amount (INR)",
    ];

    const rows = orders.map((o) => [
      `"${o.order_no}"`,
      `"${o.order_type}"`,
      `"${o.address_snapshot.name || ""}"`,
      `"${o.address_snapshot.city}"`,
      `"${o.address_snapshot.state}"`,
      `"${formatDate(o.created_at)}"`,
      `"${o.payment_method}"`,
      `"${o.payment_status}"`,
      `"${o.status}"`,
      o.subtotal,
      o.shipping_fee ?? o.shipping ?? 0,
      o.total_amount ?? o.total ?? 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join(
      "\n"
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `trio_dealers_sales_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
              Sales Analytics & Accounting Reports
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              Review commercial revenue breakdowns and export audit-ready CSV order records.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={orders.length === 0}
            className="px-4 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Orders (CSV)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl luxury-card border border-gold-500/35 space-y-2">
            <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider block">
              Consolidated Revenue
            </span>
            <div className="text-3xl font-heading font-black text-ink">
              {formatINR(totalRevenue)}
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Live platform order totals
            </p>
          </div>

          <div className="p-6 rounded-2xl luxury-card space-y-2">
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider block">
              Wholesale B2B Sales
            </span>
            <div className="text-3xl font-heading font-black text-gold-400">
              {formatINR(wholesaleRevenue)}
            </div>
            <p className="text-xs text-ink-muted">
              Boutique consignments & fabric bolts
            </p>
          </div>

          <div className="p-6 rounded-2xl luxury-card space-y-2">
            <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider block">
              Retail Consumer Sales
            </span>
            <div className="text-3xl font-heading font-black text-ink">
              {formatINR(retailRevenue)}
            </div>
            <p className="text-xs text-ink-muted">Direct-to-consumer orders</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl luxury-card space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-edge">
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold-400" />
              Sales Period Summary
            </h3>

            <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-edge text-xs">
              {(["daily", "weekly", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                    timeframe === t
                      ? "bg-gold-500 text-black font-bold"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-muted uppercase text-[10px] tracking-wider border-b border-edge">
                <tr>
                  <th className="py-2.5 font-semibold">Period</th>
                  <th className="py-2.5 font-semibold text-center">
                    Orders Count
                  </th>
                  <th className="py-2.5 font-semibold text-center">
                    Retail Total
                  </th>
                  <th className="py-2.5 font-semibold text-center">
                    Wholesale Total
                  </th>
                  <th className="py-2.5 font-semibold text-right">
                    Net Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-ink-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      Loading analytics...
                    </td>
                  </tr>
                ) : groupedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      No order transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  groupedRows.map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 font-medium text-ink">
                        {row.label}
                      </td>
                      <td className="py-3 text-center font-mono">
                        {row.count}
                      </td>
                      <td className="py-3 text-center font-mono">
                        {formatINR(row.retail)}
                      </td>
                      <td className="py-3 text-center font-mono">
                        {formatINR(row.wholesale)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-gold-400">
                        {formatINR(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
