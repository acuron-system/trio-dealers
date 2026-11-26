"use client";

import React, { useState, useEffect } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchShopPayoutData } from "@/lib/db";
import { useAuth } from "@/context/auth-context";
import { Payout } from "@/types/database";
import { formatINR, formatDate } from "@/lib/utils";
import { CreditCard, CheckCircle2, Building, Check } from "lucide-react";

export default function AdminPayoutsPage() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayouts() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { payouts: rows } = await fetchShopPayoutData(supabase);
      setPayouts(rows);
      setLoading(false);
    }
    loadPayouts();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleStartSettle = (pay: Payout) => {
    setSettlingId(pay.id);
    setUtrInput(`UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`);
  };

  const handleConfirmSettle = async (id: string) => {
    if (!utrInput.trim()) {
      alert("Please provide the bank UTR reference number.");
      return;
    }

    const supabase = createClient();
    const settledAt = new Date().toISOString();
    const { error } = await supabase
      .from("payouts")
      .update({
        status: "settled",
        reference_id: utrInput,
        settled_at: settledAt,
        settled_by: user?.id || null,
      })
      .eq("id", id);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setPayouts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "settled",
              reference_id: utrInput,
              settled_at: settledAt,
            }
          : p
      )
    );
    setSettlingId(null);
    showToast(`Payout settled successfully! UTR reference: ${utrInput}`);
  };

  const totalSettled = payouts
    .filter((p) => p.status === "settled")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              <CreditCard className="w-3.5 h-3.5" /> Platform Merchant Settlement
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              Seller Payouts & Commission Settlement
            </h1>
            <p className="text-xs text-ink-secondary">
              Disburse net sales proceeds to verified seller bank accounts and record RTGS/NEFT transaction references.
            </p>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl luxury-card border border-gold-500/35 space-y-1">
            <span className="text-xs text-gold-400 font-semibold">
              Pending Settlement Run
            </span>
            <p className="text-3xl font-bold font-mono text-ink">
              {formatINR(totalPending)}
            </p>
            <p className="text-[11px] text-ink-muted">
              Awaiting bank RTGS processing
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-1">
            <span className="text-xs text-ink-secondary">
              Total Settled to Sellers
            </span>
            <p className="text-3xl font-bold font-mono text-ink">
              {formatINR(totalSettled)}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Successfully remitted to mills
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-1">
            <span className="text-xs text-ink-secondary">
              Platform Commission Earned
            </span>
            <p className="text-3xl font-bold font-mono text-gold-400">
              {formatINR(totalSettled * 0.1)}
            </p>
            <p className="text-[11px] text-ink-muted">
              Retained platform commission (10%)
            </p>
          </div>
        </div>

        <div className="rounded-3xl luxury-card overflow-hidden">
          <div className="p-6 border-b border-edge">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
              Payout Request & Settlement Records
            </h2>
          </div>

          <div className="divide-y divide-edge">
            {loading ? (
              <div className="p-8 text-center text-xs text-ink-muted">
                Loading payouts...
              </div>
            ) : payouts.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted">
                No payout requests recorded yet.
              </div>
            ) : (
              payouts.map((pay) => (
                <div
                  key={pay.id}
                  className="p-6 space-y-4 hover:bg-surface-subtle/40 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-ink text-base">
                          {pay.shop?.shop_name || "Seller Store"}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pay.status === "settled"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {pay.status}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary">
                        Requested: {formatDate(pay.created_at)}
                        {pay.reference_id && ` • Bank UTR: ${pay.reference_id}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-ink-muted">
                          Payout Amount
                        </p>
                        <p className="text-xl font-bold font-mono text-gold-400">
                          {formatINR(pay.amount)}
                        </p>
                      </div>

                      {pay.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleStartSettle(pay)}
                          className="px-4 py-2 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          Execute Settlement
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-subtle border border-edge flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>
                        Bank:{" "}
                        <strong className="text-ink">
                          {pay.bank_details.bank_name}
                        </strong>
                      </span>
                    </div>
                    <div>
                      <span>
                        A/C:{" "}
                        <strong className="text-ink">
                          {pay.bank_details.account_no}
                        </strong>
                      </span>
                    </div>
                    <div>
                      <span>
                        IFSC:{" "}
                        <strong className="text-gold-400">
                          {pay.bank_details.ifsc}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {settlingId === pay.id && (
                    <div className="p-4 rounded-2xl bg-surface-subtle border border-gold-500/45 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gold-400">
                        Confirm Bank NEFT/RTGS Settlement
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="Enter Bank Transfer UTR Number..."
                          value={utrInput}
                          onChange={(e) =>
                            setUtrInput(e.target.value.toUpperCase())
                          }
                          className="flex-1 px-3.5 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono text-xs outline-none focus:border-gold-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSettlingId(null)}
                            className="px-4 py-2 rounded-xl bg-surface border border-edge text-ink-secondary text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmSettle(pay.id)}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                          >
                            Confirm & Mark Settled
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
