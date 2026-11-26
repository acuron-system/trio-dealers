"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Image as ImageIcon, Layout, CheckCircle2, Trash2 } from "lucide-react";

export default function AdminHomepagePage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Shop Now");
  const [ctaHref, setCtaHref] = useState("/catalog");
  const [placement, setPlacement] = useState<"hero" | "mid" | "promo">("hero");
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const [{ data: b }, { data: s }] = await Promise.all([
      supabase.from("banners").select("*").order("sort_order", { ascending: true }),
      supabase.from("homepage_sections").select("*").order("sort_order", { ascending: true }),
    ]);
    setBanners(b || []);
    setSections(s || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revalidateHome = async () => {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["homepage", "banners"] }),
    }).catch(() => null);
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("banners").insert({
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      image_url: imageUrl.trim(),
      cta_label: ctaLabel.trim() || "Explore",
      cta_href: ctaHref.trim() || "/catalog",
      placement,
      sort_order: banners.length + 1,
      is_active: true,
    });
    if (!error) {
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      await revalidateHome();
      setToast("Homepage banner added & cache revalidated.");
      await loadData();
    }
  };

  const toggleBanner = async (b: any) => {
    const supabase = createClient();
    await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    await revalidateHome();
    await loadData();
  };

  const deleteBanner = async (id: string) => {
    const supabase = createClient();
    await supabase.from("banners").delete().eq("id", id);
    await revalidateHome();
    await loadData();
  };

  const toggleSection = async (s: any) => {
    const supabase = createClient();
    await supabase
      .from("homepage_sections")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    await revalidateHome();
    await loadData();
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <Layout className="w-6 h-6 text-gold-500" />
            Dynamic Homepage &amp; Scheduled Banners Builder
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Control hero banners, placement schedules, and section visibility dynamically without code deploys.
          </p>
        </div>

        {toast && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        )}

        <form onSubmit={handleAddBanner} className="luxury-card rounded-2xl p-6 space-y-4 text-xs">
          <h2 className="font-bold text-sm text-ink flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gold-400" /> Add Homepage Banner
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Headline *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <input
              type="url"
              required
              placeholder="Banner Image URL (HTTPS) *"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <input
              type="text"
              placeholder="Subtitle / Description"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="md:col-span-2 px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <input
              type="text"
              placeholder="CTA Label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="CTA Route (/catalog)"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              />
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
              >
                <option value="hero">Hero</option>
                <option value="mid">Mid Page</option>
                <option value="promo">Promo Strip</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-gold-luxury px-5 py-2.5 rounded-xl">
            Publish Banner
          </button>
        </form>

        <div className="luxury-card rounded-2xl p-6 space-y-4 text-xs">
          <h2 className="font-bold text-sm text-ink">Configured Banners ({banners.length})</h2>
          {banners.length === 0 ? (
            <p className="text-ink-muted">No banners created yet.</p>
          ) : (
            <div className="divide-y divide-edge">
              {banners.map((b) => (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-ink">
                      {b.title} <span className="text-gold-400 font-mono">[{b.placement}]</span>
                    </p>
                    <p className="text-ink-muted">{b.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBanner(b)}
                      className={`px-3 py-1 rounded-lg font-bold ${
                        b.is_active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-surface-subtle text-ink-muted"
                      }`}
                    >
                      {b.is_active ? "Active" : "Paused"}
                    </button>
                    <button
                      onClick={() => deleteBanner(b.id)}
                      className="p-1.5 text-ink-muted hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="luxury-card rounded-2xl p-6 space-y-4 text-xs">
          <h2 className="font-bold text-sm text-ink">
            Homepage Sections Order ({sections.length})
          </h2>
          {sections.length === 0 ? (
            <p className="text-ink-muted">Default dynamic layout active.</p>
          ) : (
            <div className="divide-y divide-edge">
              {sections.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-ink">
                      #{s.sort_order} • {s.title}
                    </p>
                    <p className="text-ink-muted">Type: {s.section_type}</p>
                  </div>
                  <button
                    onClick={() => toggleSection(s)}
                    className={`px-3 py-1 rounded-lg font-bold ${
                      s.is_active
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-surface-subtle text-ink-muted"
                    }`}
                  >
                    {s.is_active ? "Visible" : "Hidden"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

