"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { KycStatus, Shop } from "@/types/database";
import { Store, CheckCircle2 } from "lucide-react";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadShops() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });
      setShops((data as Shop[]) || []);
      setLoading(false);
    }
    loadShops();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleStatusChange = async (id: string, status: KycStatus) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("shops")
      .update({ kyc_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setShops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, kyc_status: status } : s))
    );
    showToast(`Seller KYC status updated to ${status.toUpperCase()}`);
  };

  const handleCommissionChange = async (id: string, rate: number) => {
    const clamped = Math.max(0, Math.min(30, rate));
    const supabase = createClient();
    const { error } = await supabase
      .from("shops")
      .update({
        commission_rate: clamped,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setShops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, commission_rate: clamped } : s))
    );
  };

  const filteredShops =
    filterStatus === "all"
      ? shops
      : shops.filter((s) => s.kyc_status === filterStatus);

  return (
    <div className="bg-canvas min-h-screen text-ink pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Store className="w-3.5 h-3.5" /> Multi-Vendor Seller KYC Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              Seller Shops & Commission Control
            </h1>
            <p className="text-xs text-ink-secondary">
              Review seller GSTIN/PAN onboarding documents, suspend non-compliant shops, and manage platform commission percentages.
            </p>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
          {["all", "pending", "approved", "rejected", "suspended"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-4 py-2 rounded-xl transition ${
                filterStatus === st
                  ? "bg-gold-500 text-black shadow-gold"
                  : "bg-surface text-ink-secondary hover:text-ink border border-edge"
              }`}
            >
              {st} (
              {st === "all"
                ? shops.length
                : shops.filter((s) => s.kyc_status === st).length}
              )
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="p-8 rounded-2xl luxury-card text-center text-xs text-ink-muted">
              Loading seller KYC applications...
            </div>
          ) : filteredShops.length === 0 ? (
            <div className="p-8 rounded-2xl luxury-card text-center text-xs text-ink-muted">
              No seller shops matching this filter.
            </div>
          ) : (
            filteredShops.map((s) => (
              <div
                key={s.id}
                className="p-6 rounded-3xl luxury-card hover:border-gold-500/40 transition space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-ink">
                        {s.shop_name}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.kyc_status === "approved"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            : s.kyc_status === "pending"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30"
                        }`}
                      >
                        {s.kyc_status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      Location: {s.address_line1}, {s.city}, {s.state} ({s.pincode})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.kyc_status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, "approved")}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve KYC
                      </button>
                    )}

                    {s.kyc_status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, "rejected")}
                        className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-red-600 text-ink-secondary hover:text-white font-bold text-xs transition border border-edge"
                      >
                        Reject
                      </button>
                    )}

                    {s.kyc_status === "approved" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, "suspended")}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-600 text-amber-700 dark:text-amber-300 hover:text-white font-bold text-xs transition border border-amber-500/35"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-surface-subtle text-xs">
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Tax Identity
                    </span>
                    <p className="text-ink font-mono mt-0.5">
                      GSTIN: {s.gstin || "N/A"}
                    </p>
                    <p className="text-ink-secondary font-mono text-[11px]">
                      PAN: {s.pan || "N/A"}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Bank Account
                    </span>
                    <p className="text-ink font-semibold mt-0.5">{s.bank_name}</p>
                    <p className="text-ink-secondary font-mono text-[11px]">
                      A/C: {s.bank_account_no}
                    </p>
                    <p className="text-ink-muted font-mono text-[10px]">
                      IFSC: {s.bank_ifsc}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Commission Rate
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="30"
                        value={s.commission_rate}
                        onChange={(e) =>
                          handleCommissionChange(
                            s.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-16 px-2 py-1 rounded-lg bg-surface-input border border-edge text-ink font-mono text-xs"
                      />
                      <span className="text-gold-400 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase font-mono">
                      Storefront Link
                    </span>
                    <Link
                      href={`/shop/${s.slug}`}
                      className="text-gold-400 hover:underline flex items-center gap-1 mt-1 font-semibold"
                    >
                      /shop/{s.slug} →
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
