"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { formatDate } from "@/lib/utils";
import {
  Bell,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Scale,
  Store,
  Send,
  AlertCircle,
} from "lucide-react";

interface ProductQAItem {
  id: string;
  question: string;
  answer?: string | null;
  created_at: string;
  answered_at?: string | null;
  user?: { full_name?: string | null } | null;
}

interface AddonsProps {
  productId: string;
  variantId?: string;
  shopId?: string | null;
  shopName?: string | null;
  stockQty?: number;
}

export function ProductInteractiveAddons({
  productId,
  variantId,
  shopId,
  shopName,
  stockQty = 0,
}: AddonsProps) {
  const { user } = useAuth();

  // Pincode check state
  const [pincode, setPincode] = useState("");
  const [pincodeResult, setPincodeResult] = useState<{
    checked: boolean;
    serviceable?: boolean;
    text?: string;
  }>({ checked: false });

  // Compare & Alert state
  const [isCompared, setIsCompared] = useState(false);
  const [followingShop, setFollowingShop] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  // Q&A state
  const [questions, setQuestions] = useState<ProductQAItem[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [qaStatus, setQaStatus] = useState<string | null>(null);
  const [submittingQa, setSubmittingQa] = useState(false);

  useEffect(() => {
    // Check compare storage
    try {
      const list: string[] = JSON.parse(localStorage.getItem("trio_compare") || "[]");
      setIsCompared(list.includes(productId));
    } catch {
      // ignore
    }

    // Track recently viewed if signed in
    if (user) {
      fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "view_product", productId }),
      }).catch(() => null);
    }

    // Load dynamic product Q&A
    fetch(`/api/questions?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []))
      .catch(() => null);
  }, [productId, user]);

  const handlePincodeCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pincode.trim())) {
      setPincodeResult({
        checked: true,
        serviceable: false,
        text: "Enter a valid 6-digit Indian pincode.",
      });
      return;
    }

    const res = await fetch(`/api/service-areas?pincode=${encodeURIComponent(pincode.trim())}`);
    const data = await res.json();
    setPincodeResult({
      checked: true,
      serviceable: Boolean(data.serviceable),
      text: data.serviceable
        ? `Available for ${pincode.trim()}${data.city ? ` (${data.city})` : ""} • Estimated ${data.estimatedDays || 4} days${data.codAvailable ? " • COD Supported" : ""}`
        : data.message || "Delivery unavailable for this pincode.",
    });
  };

  const toggleCompare = () => {
    try {
      const existing: string[] = JSON.parse(localStorage.getItem("trio_compare") || "[]");
      let next: string[];
      if (existing.includes(productId)) {
        next = existing.filter((x) => x !== productId);
        setIsCompared(false);
      } else {
        next = [...existing.slice(-3), productId];
        setIsCompared(true);
      }
      localStorage.setItem("trio_compare", JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const triggerAlert = async (type: "price_alert" | "stock_alert" | "follow_shop") => {
    setAlertFeedback(null);
    if (!user) {
      setAlertFeedback("Please sign in to save alerts or follow mills.");
      return;
    }
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        productId: type === "price_alert" ? productId : undefined,
        variantId: type === "stock_alert" ? variantId : undefined,
        shopId: type === "follow_shop" ? shopId || undefined : undefined,
      }),
    });
    const data = await res.json();
    if (type === "follow_shop") {
      setFollowingShop(Boolean(data.following));
      setAlertFeedback(data.following ? `Following ${shopName || "seller"}` : "Unfollowed seller.");
    } else {
      setAlertFeedback(data.message || "Saved notification preference.");
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    setSubmittingQa(true);
    setQaStatus(null);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, question: questionText.trim() }),
    });
    const data = await res.json();
    setSubmittingQa(false);
    if (!res.ok) {
      setQaStatus(data.error || "Unable to post question.");
      return;
    }
    setQuestions((prev) => [data.question, ...prev]);
    setQuestionText("");
    setQaStatus("Question posted! The seller mill will answer shortly.");
  };

  return (
    <div className="space-y-8 pt-6 border-t border-edge">
      {/* Pincode Serviceability & Quick Utility Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="luxury-card rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gold-400" />
            Check Delivery &amp; COD Availability
          </h3>
          <form onSubmit={handlePincodeCheck} className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit pincode (e.g. 395002)"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-surface-input border border-edge text-xs font-mono text-ink outline-none focus:border-gold-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gold-500/15 border border-gold-500/40 text-gold-400 text-xs font-bold hover:bg-gold-500 hover:text-black transition"
            >
              Check
            </button>
          </form>
          {pincodeResult.checked && (
            <p
              className={`text-[11px] flex items-center gap-1.5 ${
                pincodeResult.serviceable ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {pincodeResult.serviceable ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {pincodeResult.text}
            </p>
          )}
        </div>

        <div className="luxury-card rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
            Compare, Alerts &amp; Seller Follow
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleCompare}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                isCompared
                  ? "border-gold-500 bg-gold-500/15 text-gold-400"
                  : "border-edge text-ink-secondary hover:text-ink"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              {isCompared ? "Added to Compare" : "Compare Fabric"}
            </button>

            {isCompared && (
              <Link
                href="/compare"
                className="px-3 py-2 rounded-xl bg-gold-500 text-black text-xs font-bold"
              >
                Open Comparison →
              </Link>
            )}

            <button
              type="button"
              onClick={() => triggerAlert("price_alert")}
              className="px-3 py-2 rounded-xl border border-edge text-xs font-semibold text-ink-secondary hover:text-gold-400 inline-flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              Price Drop Alert
            </button>

            {stockQty <= 0 && variantId && (
              <button
                type="button"
                onClick={() => triggerAlert("stock_alert")}
                className="px-3 py-2 rounded-xl border border-edge text-xs font-semibold text-amber-400 inline-flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                Notify When In Stock
              </button>
            )}

            {shopId && (
              <button
                type="button"
                onClick={() => triggerAlert("follow_shop")}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                  followingShop
                    ? "border-gold-500 bg-gold-500/15 text-gold-400"
                    : "border-edge text-ink-secondary hover:text-ink"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                {followingShop ? "Following Mill ✓" : `Follow ${shopName || "Mill"}`}
              </button>
            )}
          </div>
          {alertFeedback && (
            <p className="text-[11px] text-gold-400">{alertFeedback}</p>
          )}
        </div>
      </div>

      {/* Buyer Questions & Mill Answers (Q&A) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gold-400" />
            Buyer Questions &amp; Mill Answers ({questions.length})
          </h3>
        </div>

        <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            maxLength={500}
            placeholder="Ask the mill about weave GSM, shrinkage, dye fastness, or custom cutting..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-input border border-edge text-xs text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
          />
          <button
            type="submit"
            disabled={submittingQa}
            className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submittingQa ? "Posting..." : "Ask Mill"}
          </button>
        </form>

        {qaStatus && <p className="text-xs text-gold-400">{qaStatus}</p>}

        {questions.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No questions asked for this fabric yet. Ask the first question above.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => (
              <div key={q.id} className="luxury-card rounded-2xl p-4 space-y-2 text-xs">
                <p className="font-bold text-ink">Q: {q.question}</p>
                {q.answer ? (
                  <p className="text-ink-secondary bg-surface-subtle rounded-xl p-3 border border-edge">
                    <strong className="text-gold-400">Mill Answer:</strong> {q.answer}
                  </p>
                ) : (
                  <p className="text-ink-muted italic">Awaiting response from seller mill...</p>
                )}
                <p className="text-[10px] text-ink-muted">
                  Asked by {q.user?.full_name || "Buyer"} • {formatDate(q.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

