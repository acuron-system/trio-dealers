"use client";

import React, { useState, useEffect } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { B2BAccount, B2BVerificationStatus } from "@/types/database";
import { formatINR, formatDate } from "@/lib/utils";
import { Building2, CheckCircle2, Save, Sliders } from "lucide-react";

export default function AdminB2BPage() {
  const [accounts, setAccounts] = useState<B2BAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState<number>(0);
  const [termsInput, setTermsInput] = useState<"prepaid" | "net15" | "net30">(
    "net30"
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("b2b_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      setAccounts((data as B2BAccount[]) || []);
      setLoading(false);
    }
    loadAccounts();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleStatusChange = async (
    id: string,
    status: B2BVerificationStatus
  ) => {
    const existing = accounts.find((a) => a.id === id);
    const nextCredit =
      status === "approved" && (!existing || existing.credit_limit === 0)
        ? 50000
        : existing?.credit_limit || 0;
    const nextBalance =
      status === "approved" && (!existing || existing.credit_balance === 0)
        ? 50000
        : existing?.credit_balance || 0;

    const supabase = createClient();
    const { error } = await supabase
      .from("b2b_accounts")
      .update({
        verification_status: status,
        credit_limit: nextCredit,
        credit_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              verification_status: status,
              credit_limit: nextCredit,
              credit_balance: nextBalance,
            }
          : acc
      )
    );
    showToast(
      `B2B Account verification status updated to ${status.toUpperCase()}`
    );
  };

  const handleStartEdit = (acc: B2BAccount) => {
    setEditingId(acc.id);
    setCreditInput(acc.credit_limit);
    setTermsInput(acc.payment_terms);
  };

  const handleSaveTerms = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("b2b_accounts")
      .update({
        credit_limit: creditInput,
        credit_balance: creditInput,
        payment_terms: termsInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              credit_limit: creditInput,
              credit_balance: creditInput,
              payment_terms: termsInput,
            }
          : acc
      )
    );
    setEditingId(null);
    showToast(
      `Credit limit updated to ${formatINR(
        creditInput
      )} (${termsInput.toUpperCase()})`
    );
  };

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Building2 className="w-3.5 h-3.5" /> Commercial Trade Verification
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              B2B Accounts & Credit Term Facility
            </h1>
            <p className="text-xs text-ink-secondary">
              Sanction trade credit limits, review GST credentials, and configure repayment terms (Prepaid / Net 15 / Net 30) for wholesale buyers.
            </p>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="p-8 rounded-2xl luxury-card text-center text-xs text-ink-muted">
              Loading B2B trade applications...
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 rounded-2xl luxury-card text-center text-xs text-ink-muted">
              No B2B wholesale buyer applications registered yet.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-6 rounded-3xl luxury-card hover:border-gold-500/40 transition space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-ink">
                        {acc.business_name}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          acc.verification_status === "approved"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            : acc.verification_status === "pending"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30"
                        }`}
                      >
                        {acc.verification_status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      GSTIN:{" "}
                      <strong className="text-ink font-mono">
                        {acc.gstin}
                      </strong>{" "}
                      • Registered: {formatDate(acc.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {acc.verification_status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(acc.id, "approved")}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Account
                      </button>
                    )}

                    {acc.verification_status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(acc.id, "rejected")}
                        className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-red-600 text-ink-secondary hover:text-white font-bold text-xs transition border border-edge"
                      >
                        Reject
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartEdit(acc)}
                      className="px-3.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-input text-gold-400 border border-gold-500/35 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Configure Credit Terms
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-subtle text-xs">
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Credit Limit
                    </span>
                    <p className="text-lg font-bold font-mono text-ink mt-0.5">
                      {formatINR(acc.credit_limit)}
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      Available: {formatINR(acc.credit_balance)}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Payment Terms
                    </span>
                    <p className="text-base font-bold text-gold-400 uppercase mt-0.5">
                      {acc.payment_terms}
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      Repayment post consignment dispatch
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Compliance Audit
                    </span>
                    <p className="text-ink mt-0.5">MCA & GST Active ✓</p>
                    <p className="text-[11px] text-ink-muted">
                      Verified by Trio Admin
                    </p>
                  </div>
                </div>

                {editingId === acc.id && (
                  <div className="p-4 rounded-2xl bg-surface-subtle border border-gold-500/40 space-y-4">
                    <h3 className="font-bold text-gold-400 text-xs uppercase tracking-wider">
                      Adjust Trade Credit for {acc.business_name}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-ink-secondary mb-1 font-semibold">
                          Sanctioned Credit Limit (₹)
                        </label>
                        <input
                          type="number"
                          step="10000"
                          min="0"
                          value={creditInput}
                          onChange={(e) =>
                            setCreditInput(parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-ink-secondary mb-1 font-semibold">
                          Payment Terms
                        </label>
                        <select
                          value={termsInput}
                          onChange={(e) => setTermsInput(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                        >
                          <option value="prepaid">Prepaid (No credit)</option>
                          <option value="net15">Net 15 Days</option>
                          <option value="net30">Net 30 Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3.5 py-1.5 rounded-lg bg-surface border border-edge text-ink-secondary text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveTerms(acc.id)}
                        className="px-4 py-1.5 rounded-lg btn-gold-luxury text-xs flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save & Sanction Credit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
