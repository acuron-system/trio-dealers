"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { formatDate, formatINR } from "@/lib/utils";
import { RotateCcw, CheckCircle2 } from "lucide-react";

export default function AdminReturnsPage() {
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/returns").then((r) => r.json()).catch(() => ({ returns: [] }));
    setReturnsList(res.returns || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransition = async (
    returnId: string,
    status: "approved" | "rejected" | "pickup_scheduled" | "received" | "refunded"
  ) => {
    const res = await fetch("/api/returns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnId, status }),
    });
    if (res.ok) {
      setMsg(`Return updated to ${status.toUpperCase()}.`);
      await load();
      setTimeout(() => setMsg(null), 3500);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-gold-500" />
            Returns, Exchanges &amp; Refund Settlements
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Review marketplace return disputes and settle verified refunds to Store Wallet or Razorpay.
          </p>
        </div>

        {msg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {msg}
          </div>
        )}

        <div className="luxury-card rounded-2xl overflow-hidden text-xs">
          {loading ? (
            <p className="p-6 text-ink-muted">Loading return requests...</p>
          ) : returnsList.length === 0 ? (
            <p className="p-8 text-center text-ink-muted">No active return requests in the platform queue.</p>
          ) : (
            <div className="divide-y divide-edge">
              {returnsList.map((r) => (
                <div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-ink">
                      {r.sub_order?.sub_order_no} ({r.sub_order?.shop?.shop_name || "Mill"}) •{" "}
                      <span className="text-gold-400 font-mono">
                        {formatINR(r.refund_amount || r.sub_order?.total || 0)}
                      </span>
                    </p>
                    <p className="text-ink-muted">
                      Type: {r.return_type} • Method: {r.refund_method} • Reason: {r.reason} •{" "}
                      {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-surface-subtle border border-edge uppercase font-bold text-[10px]">
                      {r.status}
                    </span>
                    {r.status === "requested" && (
                      <>
                        <button
                          onClick={() => handleTransition(r.id, "approved")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleTransition(r.id, "rejected")}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(r.status === "approved" || r.status === "received") && (
                      <button
                        onClick={() => handleTransition(r.id, "refunded")}
                        className="btn-gold-luxury px-4 py-1.5 rounded-lg font-bold"
                      >
                        Settle Refund
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

