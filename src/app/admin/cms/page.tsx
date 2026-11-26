"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeRichText } from "@/lib/security/sanitize";
import { FileText, Settings, CheckCircle2 } from "lucide-react";

export default function AdminCmsPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [slug, setSlug] = useState("about");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  // Key DB Site Settings
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const [{ data: cms }, { data: sets }] = await Promise.all([
      supabase.from("cms_pages").select("*").order("slug", { ascending: true }),
      supabase.from("settings").select("*"),
    ]);

    setPages(cms || []);
    const matched = (cms || []).find((p: any) => p.slug === slug);
    if (matched) {
      setTitle(matched.title || "");
      setBodyHtml(matched.content_html || "");
    }

    const map = new Map((sets || []).map((r: any) => [r.key, r.value || {}]));
    const ann = map.get("announcement_bar") || {};
    const contact = map.get("contact_info") || {};
    const bank = map.get("bank_transfer_info") || {};

    setAnnouncementText(ann.text || "");
    setAnnouncementEnabled(Boolean(ann.enabled));
    setPhone(contact.phone || "");
    setEmail(contact.email || "");
    setWhatsapp(contact.whatsapp || "");
    setAddress(contact.address || "");
    setGstin(contact.gstin || "");
    setUpiId(bank.upi_id || "");
    setBankAccountNo(bank.account_no || "");
    setBankIfsc(bank.ifsc || "");
  }, [slug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const revalidateConfig = async () => {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["cms", "settings"] }),
    }).catch(() => null);
  };

  const handleSaveCmsPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const cleanHtml = sanitizeRichText(bodyHtml);
    await supabase.from("cms_pages").upsert(
      {
        slug: slug.trim().toLowerCase(),
        title: title.trim() || slug,
        content_html: cleanHtml,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );
    await revalidateConfig();
    setToast(`Published CMS page /pages/${slug}.`);
    await loadAll();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    await Promise.all([
      supabase.from("settings").upsert(
        {
          key: "announcement_bar",
          value: { enabled: announcementEnabled, text: announcementText.trim(), link_url: "/catalog" },
        },
        { onConflict: "key" }
      ),
      supabase.from("settings").upsert(
        {
          key: "contact_info",
          value: {
            phone: phone.trim(),
            email: email.trim(),
            whatsapp: whatsapp.trim(),
            address: address.trim(),
            gstin: gstin.trim().toUpperCase(),
          },
        },
        { onConflict: "key" }
      ),
      supabase.from("settings").upsert(
        {
          key: "bank_transfer_info",
          value: {
            upi_id: upiId.trim(),
            account_no: bankAccountNo.trim(),
            ifsc: bankIfsc.trim().toUpperCase(),
          },
        },
        { onConflict: "key" }
      ),
    ]);
    await revalidateConfig();
    setToast("Global settings updated in DB & revalidated.");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <FileText className="w-6 h-6 text-gold-500" />
            Dynamic CMS Pages &amp; Global Store Settings
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Edit announcement bars, contact details, bank transfer info, and policy pages dynamically (sanitized HTML).
          </p>
        </div>

        {toast && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CMS Page Editor */}
          <form onSubmit={handleSaveCmsPage} className="luxury-card rounded-2xl p-6 space-y-4 text-xs">
            <h2 className="font-bold text-sm text-ink">Policy &amp; Content Page Editor</h2>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="about">About Us (/pages/about)</option>
                <option value="faq">FAQ (/pages/faq)</option>
                <option value="shipping">Shipping Policy (/pages/shipping)</option>
                <option value="returns">Returns &amp; Refunds (/pages/returns)</option>
                <option value="privacy">DPDP Privacy Policy (/pages/privacy)</option>
                <option value="terms">Terms of Trade (/pages/terms)</option>
              </select>
              <input
                type="text"
                required
                placeholder="Page Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
            </div>

            <textarea
              rows={9}
              required
              placeholder="Write sanitized HTML or plain paragraphs (<h2>, <p>, <ul>, <li>, <strong>)..."
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-input border border-edge text-ink font-mono"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-ink-muted">
                Published pages: {pages.length}
              </span>
              <button type="submit" className="btn-gold-luxury px-5 py-2 rounded-xl">
                Save &amp; Publish Page
              </button>
            </div>
          </form>

          {/* Store Settings Editor */}
          <form onSubmit={handleSaveSettings} className="luxury-card rounded-2xl p-6 space-y-4 text-xs">
            <h2 className="font-bold text-sm text-ink flex items-center gap-2">
              <Settings className="w-4 h-4 text-gold-400" />
              Navbar, Footer &amp; Bank Settings
            </h2>

            <label className="flex items-center gap-2 font-semibold text-ink">
              <input
                type="checkbox"
                checked={announcementEnabled}
                onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                className="accent-gold-500"
              />
              Show Top Announcement Bar
            </label>

            <input
              type="text"
              placeholder="Announcement text..."
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Support Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <input
                type="email"
                placeholder="Support Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <input
                type="text"
                placeholder="WhatsApp Number (91...)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <input
                type="text"
                placeholder="Corporate GSTIN"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
            </div>

            <input
              type="text"
              placeholder="Registered Warehouse / Office Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink"
            />

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-edge">
              <input
                type="text"
                placeholder="UPI ID"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
              <input
                type="text"
                placeholder="Bank Account No"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
              <input
                type="text"
                placeholder="IFSC Code"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-input border border-edge font-mono text-ink"
              />
            </div>

            <button type="submit" className="btn-gold-luxury px-5 py-2.5 rounded-xl">
              Save Global Settings
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

