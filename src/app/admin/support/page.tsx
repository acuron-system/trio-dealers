"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { formatDate } from "@/lib/utils";
import { LifeBuoy, Send } from "lucide-react";

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/support").then((r) => r.json()).catch(() => ({ tickets: [] }));
    setTickets(res.tickets || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReply = async (ticketId: string, status?: "in_progress" | "resolved") => {
    const message = (replyText[ticketId] || "").trim() || "Ticket status updated by Admin.";
    const res = await fetch("/api/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, message, status }),
    });
    if (res.ok) {
      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      await load();
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-gold-500" />
            Customer &amp; Partner Support Desk
          </h1>
        </div>

        <div className="space-y-4">
          {loading ? (
            <p className="text-xs text-ink-muted">Loading support tickets...</p>
          ) : tickets.length === 0 ? (
            <div className="luxury-card rounded-2xl p-8 text-center text-xs text-ink-muted">
              No support tickets open right now.
            </div>
          ) : (
            tickets.map((tk) => (
              <div key={tk.id} className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-ink">{tk.subject}</h3>
                    <p className="text-ink-muted">
                      Category: {tk.category} • Updated {formatDate(tk.updated_at)}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400 font-bold uppercase text-[10px]">
                    {tk.status}
                  </span>
                </div>

                <div className="space-y-1.5 bg-surface-subtle p-3 rounded-xl border border-edge">
                  {(tk.messages || []).map((m: any) => (
                    <p key={m.id} className="text-ink-secondary">
                      • {m.body}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Write admin response..."
                    value={replyText[tk.id] || ""}
                    onChange={(e) =>
                      setReplyText((prev) => ({ ...prev, [tk.id]: e.target.value }))
                    }
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
                  />
                  <button
                    onClick={() => handleReply(tk.id, "in_progress")}
                    className="px-4 py-2 rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400 font-bold inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button
                    onClick={() => handleReply(tk.id, "resolved")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Resolve Ticket
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

