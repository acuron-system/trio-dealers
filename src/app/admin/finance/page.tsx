"use client";

import React, { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDate, formatINR } from "@/lib/utils";
import { CreditCard, Download, Printer } from "lucide-react";

export default function AdminFinancePage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [b2bAging, setB2bAging] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      const [{ data: p }, { data: c }, { data: r }, { data: b }] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(50),
        supabase
          .from("commissions")
          .select("*, shop:shops(shop_name)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("refunds").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("b2b_accounts").select("business_name, credit_limit, credit_balance, payment_terms"),
      ]);
      setPayments(p || []);
      setCommissions(c || []);
      setRefunds(r || []);
      setB2bAging(b || []);
    }
    load();
  }, []);

  const exportCsv = () => {
    const header = ["Date,Provider,OrderID,Amount,Status"];
    const rows = payments.map(
      (p) => `${p.created_at},${p.provider},${p.order_id},${p.amount},${p.status}`
    );
    const blob = new Blob([[...header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trio_dealers_finance_ledger.csv";
    a.click();
  };

  const totalCommissions = commissions.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
  const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="no-print">
        <AdminNav />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-gold-500" />
              Platform Finance, Commissions, Refunds &amp; Credit Aging
            </h1>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="px-4 py-2 rounded-xl border border-edge bg-surface text-xs font-bold text-ink inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-gold-400" /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="btn-gold-luxury px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print PDF Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="luxury-card rounded-2xl p-5">
            <p className="text-ink-muted">Earned Platform Commissions</p>
            <p className="text-2xl font-mono font-bold text-gold-400 mt-1">
              {formatINR(totalCommissions)}
            </p>
          </div>
          <div className="luxury-card rounded-2xl p-5">
            <p className="text-ink-muted">Captured Payment Transactions</p>
            <p className="text-2xl font-mono font-bold text-ink mt-1">{payments.length}</p>
          </div>
          <div className="luxury-card rounded-2xl p-5">
            <p className="text-ink-muted">Processed Refunds</p>
            <p className="text-2xl font-mono font-bold text-red-400 mt-1">
              {formatINR(totalRefunded)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="luxury-card rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-sm text-ink">Commission Ledger</h2>
            <div className="divide-y divide-edge max-h-80 overflow-y-auto">
              {commissions.length === 0 ? (
                <p className="text-ink-muted py-4">No commission records yet.</p>
              ) : (
                commissions.map((c) => (
                  <div key={c.id} className="py-2.5 flex justify-between">
                    <div>
                      <p className="font-semibold text-ink">{c.shop?.shop_name || "Mill"}</p>
                      <p className="text-ink-muted">
                        Rate: {c.rate_percent}% • Gross {formatINR(c.gross_amount)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-gold-400">
                      +{formatINR(c.commission_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="luxury-card rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-sm text-ink">B2B Trade Credit Aging</h2>
            <div className="divide-y divide-edge max-h-80 overflow-y-auto">
              {b2bAging.map((b, i) => {
                const utilized = Math.max(0, Number(b.credit_limit) - Number(b.credit_balance));
                return (
                  <div key={i} className="py-2.5 flex justify-between">
                    <div>
                      <p className="font-semibold text-ink">{b.business_name}</p>
                      <p className="text-ink-muted uppercase">{b.payment_terms}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-ink">Used: {formatINR(utilized)}</p>
                      <p className="text-ink-muted">Limit: {formatINR(b.credit_limit)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
          <h2 className="font-bold text-sm text-ink">Gateway Payments Log</h2>
          <div className="divide-y divide-edge">
            {payments.length === 0 ? (
              <p className="text-ink-muted py-4">No online payment logs yet.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="py-2.5 flex justify-between">
                  <div>
                    <p className="font-mono font-bold text-ink">
                      {p.provider_payment_id || p.provider_order_id || p.order_id}
                    </p>
                    <p className="text-ink-muted">
                      {p.provider} • {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-gold-400">{formatINR(p.amount)}</p>
                    <p className="uppercase text-[10px] text-ink-muted">{p.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

