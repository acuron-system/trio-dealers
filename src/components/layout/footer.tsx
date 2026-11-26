"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PublicSiteConfig } from "@/lib/site-config";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { MessageCircle, Phone, Mail, MapPin, ShieldCheck, Truck, CreditCard, Sparkles } from "lucide-react";

interface FooterProps {
  siteConfig?: PublicSiteConfig;
}

export function Footer({ siteConfig }: FooterProps) {
  const t = useTranslations("footer");
  const navT = useTranslations("nav");

  const brandName = siteConfig?.brandName || navT("brandName");
  const brandTagline = siteConfig?.brandTagline || navT("brandTagline");
  const categories = siteConfig?.categories || [];
  const cmsLinks = siteConfig?.cmsLinks || [];
  const contact = siteConfig?.contact;
  const whatsappUrl = contact?.whatsappNumber
    ? `https://wa.me/${contact.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hello ${brandName}, I have an inquiry regarding retail/wholesale cloth orders.`
      )}`
    : null;

  return (
    <footer className="bg-surface-elevated border-t border-edge text-ink-secondary text-sm mt-20">
      {/* Platform Trust Bar */}
      <div className="border-b border-edge py-10 bg-surface/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Sparkles,
                title: "Verified Seller Mills",
                desc: "KYC-checked manufacturers and house inventory",
              },
              {
                icon: ShieldCheck,
                title: "Tiered B2B Pricing",
                desc: "MOQ wholesale slabs and GST-compliant invoicing",
              },
              {
                icon: Truck,
                title: "Tracked Dispatch",
                desc: "End-to-end fulfillment with proof of delivery",
              },
              {
                icon: CreditCard,
                title: "Razorpay, Bank & COD",
                desc: "Flexible online and offline settlement flows",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-edge hover:border-gold-500/40 transition shadow-sm"
                >
                  <div className="p-3 rounded-xl bg-gold-500/10 text-gold-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-ink font-semibold text-xs tracking-wider uppercase">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-ink-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand & WhatsApp */}
          <div className="lg:col-span-2 space-y-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-gold-500/60 shadow-gold bg-black">
                <Image src="/logo.png" alt={brandName} fill className="object-cover" />
              </div>
              <div>
                <span className="font-royal font-bold text-lg tracking-[0.18em] text-gold-gradient block leading-none">
                  {brandName}
                </span>
                <span className="text-[9px] tracking-[0.22em] text-ink-muted uppercase font-semibold">
                  {brandTagline}
                </span>
              </div>
            </Link>

            {whatsappUrl && (
              <div className="p-4 rounded-2xl bg-surface border border-emerald-500/30 space-y-2.5 max-w-sm shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t("merchantDeskOnline")}
                  </span>
                  {contact?.supportHours && (
                    <span className="text-[10px] text-ink-muted">{contact.supportHours}</span>
                  )}
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  {t("whatsappCta")}
                </a>
              </div>
            )}

            <div className="pt-1">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Dynamic Categories from DB */}
          <div className="space-y-3.5">
            <h4 className="font-semibold uppercase text-xs tracking-[0.15em] text-gold-400">
              {t("curatedWeaves")}
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary">
              {categories.length === 0 ? (
                <li className="text-ink-muted text-[11px]">No categories published yet.</li>
              ) : (
                categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
                      className="hover:text-gold-400 transition-colors"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))
              )}
              <li>
                <Link
                  href="/catalog"
                  className="text-gold-400 hover:underline flex items-center gap-1 pt-1 font-semibold"
                >
                  {t("viewAllCatalog")} →
                </Link>
              </li>
              <li>
                <Link href="/compare" className="hover:text-gold-400 transition-colors">
                  {t("compare")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Trade Portals & CMS Policies */}
          <div className="space-y-3.5">
            <h4 className="font-semibold uppercase text-xs tracking-[0.15em] text-gold-400">
              {t("tradePortals")}
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary">
              <li>
                <Link
                  href="/b2b/register"
                  className="text-gold-400 hover:underline font-bold flex items-center gap-1"
                >
                  Register B2B Buyer
                </Link>
              </li>
              <li>
                <Link href="/seller/register" className="hover:text-gold-400 transition-colors">
                  Become a Seller Mill
                </Link>
              </li>
              <li>
                <Link href="/shops" className="hover:text-gold-400 transition-colors">
                  Partner Mills Directory
                </Link>
              </li>
              {cmsLinks.slice(0, 5).map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/pages/${encodeURIComponent(page.slug)}`}
                    className="hover:text-gold-400 transition-colors"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/contact" className="hover:text-gold-400 transition-colors">
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Dynamic Contact / HQ Details from DB Settings */}
          <div className="space-y-3.5">
            <h4 className="font-semibold uppercase text-xs tracking-[0.15em] text-gold-400">
              {t("headquarters")}
            </h4>
            {contact?.address || contact?.phone || contact?.email || contact?.gstin ? (
              <div className="space-y-2.5 text-xs text-ink-secondary">
                {contact.address && (
                  <p className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <span>{contact.address}</span>
                  </p>
                )}
                {contact.phone && (
                  <p className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-gold-400 shrink-0" />
                    <span>{contact.phone}</span>
                  </p>
                )}
                {contact.email && (
                  <p className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                    <span>{contact.email}</span>
                  </p>
                )}
                {contact.gstin && (
                  <div className="pt-2 border-t border-edge text-[11px] text-ink-muted font-mono">
                    GSTIN: {contact.gstin}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Contact and corporate GSTIN details can be configured dynamically in Admin -&gt; CMS &amp; Settings.
              </p>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-edge mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
          <p>
            © {new Date().getFullYear()} {brandName}. {t("rights")}
          </p>
          <div className="flex flex-wrap gap-5 text-[11px]">
            <Link href="/catalog" className="hover:text-gold-400 transition">
              {navT("catalog")}
            </Link>
            <Link href="/deals" className="hover:text-gold-400 transition">
              {navT("deals")}
            </Link>
            <Link href="/contact" className="hover:text-gold-400 transition">
              {t("contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
