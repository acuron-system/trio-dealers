"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAuth } from "@/context/auth-context";
import { formatDate, formatINR } from "@/lib/utils";
import type { Order } from "@/types/database";
import {
  Wallet,
  Gift,
  RotateCcw,
  LifeBuoy,
  MessageSquare,
  Download,
  ShieldAlert,
  Send,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function AccountHubAddons({ orders }: { orders: Order[] }) {
  const { user, signOutAllDevices } = useAuth();

  const [subTab, setSubTab] = useState<
    "wallet" | "returns" | "support" | "chat" | "privacy"
  >("wallet");

  // Wallet & Loyalty
  const [walletData, setWalletData] = useState<{
    walletBalance: number;
    loyaltyPoints: number;
    walletEntries: any[];
    loyaltyEntries: any[];
  }>({ walletBalance: 0, loyaltyPoints: 0, walletEntries: [], loyaltyEntries: [] });
  const [giftCode, setGiftCode] = useState("");

  // Returns
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [retSubOrderId, setRetSubOrderId] = useState("");
  const [retType, setRetType] = useState<"return" | "exchange">("return");
  const [retReason, setRetReason] = useState("");

  // Support Tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketSubj, setTicketSubj] = useState("");
  const [ticketMsg, setTicketMsg] = useState("");

  // Realtime Seller Chat
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [chatMsg, setChatMsg] = useState("");

  // Feedback
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const subOrdersFlat = orders.flatMap((o) =>
    (o.sub_orders || []).map((s) => ({
      id: s.id,
      label: `${o.order_no} / ${s.sub_order_no} (${formatINR(s.total)})`,
    }))
  );

  const loadHub = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    const [wRes, rRes, sRes, cRes] = await Promise.all([
      fetch("/api/wallet").then((r) => r.json()).catch(() => ({})),
      fetch("/api/returns").then((r) => r.json()).catch(() => ({})),
      fetch("/api/support").then((r) => r.json()).catch(() => ({})),
      fetch("/api/chat?scope=buyer").then((r) => r.json()).catch(() => ({})),
    ]);

    if (typeof wRes.walletBalance === "number") setWalletData(wRes);
    if (Array.isArray(rRes.returns)) setReturnsList(rRes.returns);
    if (Array.isArray(sRes.tickets)) setTickets(sRes.tickets);
    if (Array.isArray(cRes.threads)) {
      setThreads(cRes.threads);
      if (!activeThreadId && cRes.threads[0]?.id) {
        setActiveThreadId(cRes.threads[0].id);
      }
    }
  }, [user, activeThreadId]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  // Live Realtime updates on chat_messages & orders
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`account-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          fetch("/api/chat?scope=buyer")
            .then((r) => r.json())
            .then((d) => Array.isArray(d.threads) && setThreads(d.threads))
            .catch(() => null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const showNotice = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const handleRedeemGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: giftCode.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice(false, data.error || "Gift card redemption failed.");
      return;
    }
    setGiftCode("");
    showNotice(true, data.message);
    await loadHub();
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retSubOrderId || !retReason.trim()) return;
    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subOrderId: retSubOrderId,
        returnType: retType,
        reason: retReason.trim(),
        refundMethod: "wallet",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice(false, data.error || "Unable to file return request.");
      return;
    }
    setRetReason("");
    showNotice(true, "Return/Exchange request submitted.");
    await loadHub();
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: ticketSubj.trim(),
        category: "order",
        message: ticketMsg.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice(false, data.error || "Unable to create ticket.");
      return;
    }
    setTicketSubj("");
    setTicketMsg("");
    showNotice(true, "Support ticket opened cleanly.");
    await loadHub();
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentThread = threads.find((t) => t.id === activeThreadId);
    if (!currentThread || !chatMsg.trim()) return;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: currentThread.shop_id,
        threadId: currentThread.id,
        body: chatMsg.trim(),
      }),
    });
    if (res.ok) {
      setChatMsg("");
      await loadHub();
    }
  };

  const handleDpdpExport = async () => {
    const res = await fetch("/api/privacy");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trio_dealers_dpdp_export.json`;
    a.click();
    showNotice(true, "Personal data archive downloaded.");
  };

  const handleDpdpDelete = async () => {
    const res = await fetch("/api/privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "delete", reason: "User requested account closure" }),
    });
    const data = await res.json();
    showNotice(res.ok, data.message || data.error || "Privacy request updated.");
  };

  return (
    <div className="luxury-card rounded-3xl p-6 sm:p-8 space-y-6 mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-4">
        <h2 className="text-lg font-heading font-bold text-ink">
          Wallet, Returns, Support, Live Chat &amp; DPDP Privacy
        </h2>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {(
            [
              ["wallet", "Wallet & Loyalty", Wallet],
              ["returns", "Returns", RotateCcw],
              ["support", "Support", LifeBuoy],
              ["chat", "Mill Chat", MessageSquare],
              ["privacy", "Privacy & Sessions", ShieldAlert],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition ${
                subTab === id
                  ? "bg-gold-500 text-black font-bold"
                  : "bg-surface-subtle border border-edge text-ink-secondary hover:text-ink"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            notice.ok
              ? "bg-emerald-500/10 border border-emerald-500/35 text-emerald-400"
              : "bg-red-500/10 border border-red-500/35 text-red-400"
          }`}
        >
          {notice.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      {subTab === "wallet" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-surface border border-gold-500/35">
              <p className="text-xs text-ink-muted">Store Wallet Balance</p>
              <p className="text-2xl font-mono font-bold text-gold-400 mt-1">
                {formatINR(walletData.walletBalance)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-surface border border-edge">
              <p className="text-xs text-ink-muted">Loyalty Rewards Points</p>
              <p className="text-2xl font-mono font-bold text-ink mt-1">
                {walletData.loyaltyPoints} pts
              </p>
            </div>
          </div>

          <form onSubmit={handleRedeemGiftCard} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              placeholder="Enter Gift Card Code"
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-xs font-mono uppercase text-ink"
            />
            <button
              type="submit"
              className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs inline-flex items-center justify-center gap-1.5"
            >
              <Gift className="w-4 h-4" /> Redeem Gift Card
            </button>
          </form>

          {walletData.walletEntries.length > 0 && (
            <div className="divide-y divide-edge border border-edge rounded-2xl overflow-hidden text-xs">
              {walletData.walletEntries.slice(0, 6).map((w) => (
                <div key={w.id} className="p-3 flex items-center justify-between bg-surface">
                  <div>
                    <p className="font-semibold text-ink">{w.note || w.entry_type}</p>
                    <p className="text-[11px] text-ink-muted">{formatDate(w.created_at)}</p>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      Number(w.amount_delta) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {Number(w.amount_delta) >= 0 ? "+" : ""}
                    {formatINR(w.amount_delta)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "returns" && (
        <div className="space-y-5">
          <form onSubmit={handleCreateReturn} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <select
              value={retSubOrderId}
              onChange={(e) => setRetSubOrderId(e.target.value)}
              required
              className="md:col-span-2 px-3 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            >
              <option value="">Select Sub-Order to Return/Exchange</option>
              {subOrdersFlat.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={retType}
              onChange={(e) => setRetType(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            >
              <option value="return">Return &amp; Refund</option>
              <option value="exchange">Size/Shade Exchange</option>
            </select>

            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Reason for return..."
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <button type="submit" className="btn-gold-luxury px-4 py-2 rounded-xl">
                Submit
              </button>
            </div>
          </form>

          <div className="divide-y divide-edge border border-edge rounded-2xl overflow-hidden text-xs">
            {returnsList.length === 0 ? (
              <p className="p-6 text-center text-ink-muted">No return or exchange requests yet.</p>
            ) : (
              returnsList.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 bg-surface">
                  <div>
                    <p className="font-bold text-ink">
                      {r.sub_order?.sub_order_no} • {r.return_type.toUpperCase()}
                    </p>
                    <p className="text-ink-muted">{r.reason}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400 font-bold uppercase text-[10px]">
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "support" && (
        <div className="space-y-5">
          <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
            <input
              type="text"
              required
              placeholder="Ticket Subject"
              value={ticketSubj}
              onChange={(e) => setTicketSubj(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <textarea
              rows={2}
              required
              placeholder="Describe your order, GST invoice, or dispatch issue..."
              value={ticketMsg}
              onChange={(e) => setTicketMsg(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <button type="submit" className="btn-gold-luxury px-5 py-2 rounded-xl text-xs">
              Open Support Ticket
            </button>
          </form>

          <div className="space-y-3">
            {tickets.map((tk) => (
              <div key={tk.id} className="p-4 rounded-2xl bg-surface border border-edge text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink">{tk.subject}</strong>
                  <span className="text-[10px] uppercase font-bold text-gold-400">{tk.status}</span>
                </div>
                <p className="text-ink-muted">
                  {(tk.messages || []).slice(-1)[0]?.body || "Ticket opened"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "chat" && (
        <div className="space-y-4 text-xs">
          {threads.length === 0 ? (
            <p className="text-ink-muted">
              No active buyer-mill conversations yet. Open any seller shop page to start a conversation.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {threads.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setActiveThreadId(th.id)}
                    className={`px-3 py-1.5 rounded-xl border font-semibold ${
                      activeThreadId === th.id
                        ? "border-gold-500 bg-gold-500/15 text-gold-400"
                        : "border-edge text-ink-secondary"
                    }`}
                  >
                    {th.shop?.shop_name || "Seller Mill"}
                  </button>
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-edge max-h-60 overflow-y-auto space-y-2">
                {(threads.find((t) => t.id === activeThreadId)?.messages || []).map((m: any) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl max-w-[85%] ${
                      m.sender_id === user?.id
                        ? "ml-auto bg-gold-500/15 text-ink border border-gold-500/30"
                        : "bg-surface-subtle text-ink-secondary border border-edge"
                    }`}
                  >
                    {m.body}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write message..."
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-surface-input border border-edge text-ink"
                />
                <button type="submit" className="btn-gold-luxury px-4 py-2 rounded-xl inline-flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {subTab === "privacy" && (
        <div className="space-y-4 text-xs">
          <p className="text-ink-secondary">
            Manage your rights under India&apos;s Digital Personal Data Protection (DPDP) Act and terminate active sessions across browsers.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDpdpExport}
              className="px-4 py-2.5 rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400 font-bold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export My Data (JSON)
            </button>
            <button
              type="button"
              onClick={handleDpdpDelete}
              className="px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 font-bold inline-flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" /> Request Account Anonymization
            </button>
            <button
              type="button"
              onClick={() => signOutAllDevices()}
              className="px-4 py-2.5 rounded-xl border border-edge bg-surface hover:border-red-500/50 text-ink font-semibold inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out All Devices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

