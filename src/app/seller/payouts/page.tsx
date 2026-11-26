"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchShopPayoutData, fetchShopSubOrders } from "@/lib/db";
import { formatINR, formatDate } from "@/lib/utils";
import { Payout, ShopLedger } from "@/types/database";
import {
  CreditCard,
  TrendingUp,
  Building,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

export default function SellerPayoutsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const shop = user?.shop;

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ledger, setLedger] = useState<ShopLedger[]>([]);
  const [totalShopEarnings, setTotalShopEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    async function load() {
      if (!shop || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ payouts: payRows, ledger: legRows }, subs] = await Promise.all([
        fetchShopPayoutData(supabase, shop.id),
        fetchShopSubOrders(supabase, shop.id),
      ]);
      setPayouts(payRows);
      setLedger(legRows);
      const earned = subs
        .filter((s) => s.status !== "cancelled" && s.status !== "returned")
        .reduce((acc, s) => acc + Number(s.shop_earnings || 0), 0);
      setTotalShopEarnings(earned);
      setLoading(false);
    }
    if (!authLoading) {
      load();
    }
  }, [shop, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading payout ledger...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-4">
        <h1 className="text-2xl font-bold text-ink">Seller Shop Required</h1>
        <p className="text-xs text-ink-secondary">
          Only registered seller shops can access payout settlements.
        </p>
        <Link
          href="/seller/register"
          className="inline-block px-6 py-3 btn-gold-luxury text-xs rounded-xl"
        >
          Seller Registration
        </Link>
      </div>
    );
  }

  const settledTotal = payouts
    .filter((p) => p.status === "settled")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const requestedPendingTotal = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingAmount = Math.max(
    0,
    totalShopEarnings - settledTotal - requestedPendingTotal
  );

  const handleRequestPayout = async () => {
    if (pendingAmount <= 0) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("payouts")
      .insert({
        shop_id: shop.id,
        amount: pendingAmount,
        status: "pending",
        bank_details: {
          bank_name: shop.bank_name,
          account_no: shop.bank_account_no,
          ifsc: shop.bank_ifsc,
        },
      })
      .select("*")
      .single();

    if (!error && data) {
      setPayouts([data as Payout, ...payouts]);
      setRequested(true);
      setTimeout(() => setRequested(false), 4000);
    }
  };

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5 text-gold-400" />
              Direct Mill Settlement Ledger
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              Seller Earnings & Payouts
            </h1>
            <p className="text-xs text-ink-secondary max-w-lg">
              Track automated order credits, platform commission debits (
              {shop.commission_rate}%), and bank settlement receipts with RTGS/NEFT UTR numbers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/shop-dashboard"
              className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge hover:border-gold-500 text-ink-secondary hover:text-ink text-xs font-bold transition"
            >
              ← Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={pendingAmount <= 0}
              className="px-5 py-2.5 rounded-xl btn-gold-luxury text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Request Payout ({formatINR(pendingAmount)})
            </button>
          </div>
        </div>

        {requested && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Payout request submitted to Admin Finance for NEFT transfer!
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl luxury-card border border-gold-500/35 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span className="font-semibold text-gold-400">
                Available for Payout
              </span>
              <Clock className="w-4 h-4 text-gold-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-ink">
              {formatINR(pendingAmount)}
            </p>
            <p className="text-[11px] text-ink-muted">
              Eligible balance after platform commission
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span>Total Settled to Date</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-ink">
              {formatINR(settledTotal)}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Transferred to registered bank account
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span>Registered Payout Bank</span>
              <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-bold text-ink">{shop.bank_name}</p>
            <p className="text-xs font-mono text-ink-secondary">
              A/C: •••• {shop.bank_account_no.slice(-4)}
            </p>
            <p className="text-[10px] text-ink-muted font-mono">
              IFSC: {shop.bank_ifsc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 rounded-3xl luxury-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gold-400" /> Bank Payout Records
            </h2>

            {payouts.length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">
                No payout requests submitted yet.
              </p>
            ) : (
              <div className="divide-y divide-edge">
                {payouts.map((pay) => (
                  <div
                    key={pay.id}
                    className="py-4 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-ink text-sm">
                          {formatINR(pay.amount)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            pay.status === "settled"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {pay.status}
                        </span>
                      </div>
                      <p className="text-ink-muted text-[11px]">
                        Initiated: {formatDate(pay.created_at)}
                        {pay.reference_id && ` • UTR: ${pay.reference_id}`}
                      </p>
                    </div>

                    <div className="text-right text-ink-secondary text-[11px]">
                      {pay.bank_details.bank_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold-400" /> Transaction Audit Ledger
            </h2>

            {ledger.length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">
                No ledger entries recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-edge">
                {ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {entry.type === "order_credit" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="font-semibold text-ink">
                          {entry.note || entry.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>

                    <div className="text-right font-mono">
                      <p
                        className={`font-bold ${
                          entry.type === "order_credit"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {entry.type === "order_credit" ? "+" : "-"}
                        {formatINR(entry.amount)}
                      </p>
                      <p className="text-[10px] text-ink-muted">
                        Bal: {formatINR(entry.balance_after)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
