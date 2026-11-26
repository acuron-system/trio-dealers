"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatINR } from "@/lib/utils";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function SellerReturnsPage() {
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/returns").then((r) => r.json()).catch(() => ({ returns: [] }));
    setReturnsList(res.returns || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateReturn = async (returnId: string, status: "approved" | "rejected" | "received") => {
    const res = await fetch("/api/returns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnId, status }),
    });
    if (res.ok) await load();
  };

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link
            href="/shop-dashboard"
            className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Seller Dashboard
          </Link>
          <h1 className="text-2xl font-heading font-extrabold text-ink flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-gold-400" /> Seller Return &amp; Exchange Requests
          </h1>
        </div>

        <div className="luxury-card rounded-2xl overflow-hidden text-xs">
          {loading ? (
            <p className="p-6 text-ink-muted">Loading return requests...</p>
          ) : returnsList.length === 0 ? (
            <p className="p-8 text-center text-ink-muted">No return requests for your shop yet.</p>
          ) : (
            <div className="divide-y divide-edge">
              {returnsList.map((r) => (
                <div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-ink">
                      {r.sub_order?.sub_order_no} • {r.return_type.toUpperCase()} • {formatINR(r.refund_amount || r.sub_order?.total || 0)}
                    </p>
                    <p className="text-ink-muted">
                      Reason: {r.reason} • Requested {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-surface-subtle border border-edge uppercase font-bold text-[10px]">
                      {r.status}
                    </span>
                    {r.status === "requested" && (
                      <>
                        <button
                          onClick={() => updateReturn(r.id, "approved")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateReturn(r.id, "rejected")}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        onClick={() => updateReturn(r.id, "received")}
                        className="px-3 py-1.5 rounded-lg bg-gold-500 text-black font-bold"
                      >
                        Mark Received
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

