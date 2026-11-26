"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, MessageSquare, Send, Users } from "lucide-react";

export default function SellerEngagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const shop = user?.shop;

  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [chatReply, setChatReply] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!shop || !isSupabaseConfigured()) return;
    const supabase = createClient();

    const [{ data: qaRows }, { count: followers }, chatRes] = await Promise.all([
      supabase
        .from("product_questions")
        .select("*, product:products!inner(name, shop_id)")
        .eq("product.shop_id", shop.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("shop_followers")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id),
      fetch("/api/chat?scope=shop").then((r) => r.json()).catch(() => ({ threads: [] })),
    ]);

    setQuestions(qaRows || []);
    setFollowerCount(followers ?? 0);
    setThreads(chatRes.threads || []);
  }, [shop]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const submitAnswer = async (questionId: string) => {
    const answer = (answers[questionId] || "").trim();
    if (!answer) return;
    const res = await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answer }),
    });
    if (res.ok) {
      setAnswers((prev) => ({ ...prev, [questionId]: "" }));
      await loadData();
    }
  };

  const sendThreadReply = async (threadId: string) => {
    if (!shop) return;
    const text = (chatReply[threadId] || "").trim();
    if (!text) return;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: shop.id, threadId, body: text }),
    });
    if (res.ok) {
      setChatReply((prev) => ({ ...prev, [threadId]: "" }));
      await loadData();
    }
  };

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/shop-dashboard"
              className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Seller Dashboard
            </Link>
            <h1 className="text-2xl font-heading font-extrabold text-ink">
              Buyer Q&amp;A, Followers &amp; Live Chat
            </h1>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-surface border border-gold-500/35 text-xs flex items-center gap-2">
            <Users className="w-4 h-4 text-gold-400" />
            <span>
              Shop Followers: <strong className="font-mono text-ink">{followerCount}</strong>
            </span>
          </div>
        </div>

        {/* Product Q&A */}
        <section className="space-y-4">
          <h2 className="text-base font-heading font-bold text-ink">
            Customer Product Questions
          </h2>
          {questions.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No product questions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
                  <p className="text-[11px] font-bold text-gold-400">{q.product?.name}</p>
                  <p className="font-semibold text-ink">Q: {q.question}</p>
                  {q.answer ? (
                    <p className="text-ink-secondary bg-surface-subtle p-3 rounded-xl border border-edge">
                      <strong>Your Answer:</strong> {q.answer}
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write mill answer..."
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => submitAnswer(q.id)}
                        className="btn-gold-luxury px-4 py-2 rounded-xl"
                      >
                        Answer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Buyer Threads */}
        <section className="space-y-4">
          <h2 className="text-base font-heading font-bold text-ink flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gold-400" /> Direct Buyer Conversations
          </h2>
          {threads.length === 0 ? (
            <div className="luxury-card rounded-2xl p-6 text-xs text-ink-muted">
              No buyer messages yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {threads.map((th) => (
                <div key={th.id} className="luxury-card rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-ink">{th.buyer?.full_name || "Buyer"}</strong>
                    <span className="text-[10px] text-ink-muted">{formatDate(th.updated_at)}</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto bg-surface-subtle p-3 rounded-xl">
                    {(th.messages || []).map((m: any) => (
                      <p key={m.id} className="text-ink-secondary">
                        • {m.body}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Reply to buyer..."
                      value={chatReply[th.id] || ""}
                      onChange={(e) =>
                        setChatReply((prev) => ({ ...prev, [th.id]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => sendThreadReply(th.id)}
                      className="btn-gold-luxury px-3 py-2 rounded-xl inline-flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

