"use client";

import React, { useState } from "react";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";

export function ContactFormClient() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "Wholesale Inquiry",
    message: "",
  });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSubmittedMsg(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send inquiry.");
      setSubmittedMsg(data.message || "Inquiry submitted.");
      setForm({
        name: "",
        phone: "",
        email: "",
        subject: "Wholesale Inquiry",
        message: "",
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="luxury-card-elevated rounded-3xl p-6 sm:p-8 space-y-5">
      <h2 className="text-lg font-heading font-bold text-ink">Send a Message</h2>

      {submittedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{submittedMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            required
            placeholder="Your Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
          />
          <input
            type="tel"
            placeholder="Phone / WhatsApp"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="email"
            required
            placeholder="Email Address *"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
          />
          <input
            type="text"
            required
            placeholder="Subject *"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
          />
        </div>
        <textarea
          rows={4}
          required
          placeholder="Your inquiry details..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full p-3.5 rounded-xl bg-surface-input border border-edge text-ink"
        />

        <TurnstileWidget onToken={setTurnstileToken} />

        <button
          type="submit"
          disabled={submitting}
          className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Sending..." : "Submit Inquiry"}
        </button>
      </form>
    </div>
  );
}

