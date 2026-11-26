"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { PublicSiteConfig } from "@/lib/site-config";
import {
  ShoppingBag,
  Heart,
  User as UserIcon,
  Menu,
  X,
  Search,
  Shield,
  Store,
  Building2,
  Truck,
  LogOut,
  ChevronDown,
  Phone,
  FileText,
  BadgePercent,
  Sparkles,
} from "lucide-react";

interface NavbarProps {
  siteConfig?: PublicSiteConfig;
}

export function Navbar({ siteConfig }: NavbarProps) {
  const t = useTranslations("nav");
  const { user, role, signOut } = useAuth();
  const { totalItems, subtotal, wishlistIds, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const brandName = siteConfig?.brandName || t("brandName");
  const brandTagline = siteConfig?.brandTagline || t("brandTagline");
  const announcementText =
    siteConfig?.announcement.enabled && siteConfig.announcement.text
      ? siteConfig.announcement.text
      : null;
  const announcementLink = siteConfig?.announcement.linkUrl || "/catalog";
  const topCategories = (siteConfig?.categories || []).slice(0, 2);
  const contactPhone = siteConfig?.contact.phone;

  return (
    <header className="sticky top-0 z-40 w-full transition-colors duration-200">
      {/* Dynamic Announcement Ribbon (shown only when configured & enabled in Admin settings) */}
      {(announcementText || contactPhone) && (
        <div className="bg-surface-elevated border-b border-edge py-1.5 px-4 text-[11px] text-ink-secondary">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span className="hidden md:inline font-mono tracking-wider text-[10px] text-gold-400 uppercase whitespace-nowrap">
              {brandName}
            </span>
            {announcementText ? (
              <Link
                href={announcementLink}
                className="mx-auto md:mx-0 tracking-wide truncate text-center hover:text-gold-400 transition"
              >
                {announcementText}
              </Link>
            ) : (
              <span className="mx-auto" />
            )}
            {contactPhone && (
              <div className="hidden lg:flex items-center gap-3 font-mono text-[10px] text-ink-muted whitespace-nowrap">
                <a href={`tel:${contactPhone}`} className="flex items-center gap-1 hover:text-gold-400">
                  <Phone className="w-3 h-3 text-gold-400" /> {contactPhone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="bg-surface/95 backdrop-blur-2xl border-b border-edge shadow-sm dark:shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px] gap-3">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0 group">
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border border-gold-500/60 shadow-gold group-hover:border-gold-500 transition duration-300 bg-black">
                <Image
                  src="/logo.png"
                  alt={brandName}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-500"
                  priority
                />
              </div>
              <div className="leading-none">
                <span className="font-royal font-bold text-base sm:text-lg tracking-[0.14em] text-gold-gradient block whitespace-nowrap">
                  {brandName}
                </span>
                <span className="text-[9px] tracking-[0.18em] text-ink-muted uppercase block font-semibold mt-0.5 whitespace-nowrap">
                  {brandTagline}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-5 text-[11px] font-semibold uppercase tracking-[0.1em]">
              <Link
                href="/"
                className="text-ink-secondary hover:text-gold-400 transition-colors py-1 whitespace-nowrap"
              >
                {t("home")}
              </Link>
              <Link
                href="/catalog"
                className="text-ink-secondary hover:text-gold-400 transition-colors py-1 whitespace-nowrap"
              >
                {t("catalog")}
              </Link>
              {topCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
                  className="text-ink-secondary hover:text-gold-400 transition-colors py-1 whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/deals"
                className="text-ink-secondary hover:text-gold-400 transition-colors py-1 whitespace-nowrap flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-gold-400" />
                {t("deals")}
              </Link>
              <Link
                href={role === "b2b" || role === "admin" ? "/b2b/dashboard" : "/b2b/register"}
                className="px-3 py-1.5 rounded-full bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/35 hover:border-gold-500 transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t("b2bDesk")}</span>
              </Link>
              <Link
                href={role === "shop" || role === "admin" ? "/shop-dashboard" : "/seller/register"}
                className="text-ink-secondary hover:text-gold-400 transition-colors py-1 flex items-center gap-1 whitespace-nowrap"
              >
                <Store className="w-3.5 h-3.5 text-ink-muted" />
                <span>{t("sellers")}</span>
              </Link>
            </nav>

            {/* Action Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <LanguageSwitcher />
              <ThemeToggle />

              <Link
                href="/catalog"
                aria-label={t("search")}
                className="hidden sm:inline-flex p-2 rounded-xl text-ink-secondary hover:text-gold-400 hover:bg-surface-subtle transition"
                title={t("search")}
              >
                <Search className="w-4 h-4" />
              </Link>

              <Link
                href="/catalog?tab=wishlist"
                aria-label={t("wishlist")}
                className="relative p-2 rounded-xl text-ink-secondary hover:text-gold-400 hover:bg-surface-subtle transition"
                title={t("wishlist")}
              >
                <Heart className="w-4 h-4" />
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1 right-1 bg-gold-500 text-black text-[9px] font-bold h-3.5 w-3.5 rounded-full flex items-center justify-center">
                    {wishlistIds.length}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-elevated border border-edge hover:border-gold-500/50 text-ink transition"
                aria-label={t("bag")}
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-gold-400" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-gold-500 text-black text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center shadow-sm">
                      {totalItems}
                    </span>
                  )}
                </div>
                <div className="hidden md:block text-left text-[11px] leading-tight whitespace-nowrap">
                  <span className="text-ink-muted block text-[9px] uppercase tracking-wider">
                    {t("bag")}
                  </span>
                  <span className="font-bold text-gold-400 font-mono">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </button>

              {/* Account Dropdown */}
              <div className="relative">
                {user ? (
                  <div>
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-2 text-xs bg-surface-subtle border border-edge hover:border-gold-500/60 px-2.5 sm:px-3 py-2 rounded-xl transition text-ink"
                    >
                      {role === "admin" && <Shield className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
                      {role === "shop" && <Store className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
                      {role === "b2b" && <Building2 className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
                      {role === "transporter" && <Truck className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
                      {role === "user" && <UserIcon className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
                      <span className="hidden sm:inline max-w-[96px] truncate font-medium">
                        {user.full_name || "Account"}
                      </span>
                      <ChevronDown className="w-3 h-3 text-ink-muted shrink-0" />
                    </button>

                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface border border-edge-strong shadow-luxury py-2 z-50 divide-y divide-edge">
                        <div className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-ink truncate">
                            {user.full_name}
                          </p>
                          <p className="text-[10px] text-ink-muted capitalize mt-0.5">
                            Role:{" "}
                            <span className="text-gold-400 font-bold uppercase">{role}</span>
                          </p>
                        </div>

                        <div className="py-1">
                          {role === "admin" && (
                            <Link
                              href="/admin"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                            >
                              <Shield className="w-4 h-4 text-gold-400" />
                              Admin Platform Command
                            </Link>
                          )}

                          {role === "shop" && (
                            <>
                              <Link
                                href="/shop-dashboard"
                                onClick={() => setUserDropdownOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                              >
                                <Store className="w-4 h-4 text-gold-400" />
                                Seller Dashboard & Orders
                              </Link>
                              <Link
                                href="/seller/products"
                                onClick={() => setUserDropdownOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                              >
                                <BadgePercent className="w-4 h-4 text-gold-400" />
                                Manage Products & Slabs
                              </Link>
                            </>
                          )}

                          {role === "b2b" && (
                            <>
                              <Link
                                href="/b2b/dashboard"
                                onClick={() => setUserDropdownOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                              >
                                <Building2 className="w-4 h-4 text-gold-400" />
                                B2B Wholesale & Credit Desk
                              </Link>
                              <Link
                                href="/b2b/rfq"
                                onClick={() => setUserDropdownOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                              >
                                <FileText className="w-4 h-4 text-gold-400" />
                                Custom Quotations (RFQ)
                              </Link>
                            </>
                          )}

                          {role === "transporter" && (
                            <Link
                              href="/transporter"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                            >
                              <Truck className="w-4 h-4 text-gold-400" />
                              Dispatch Portal
                            </Link>
                          )}

                          <Link
                            href="/account"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-ink-secondary hover:bg-gold-500/10 hover:text-gold-400 transition"
                          >
                            <UserIcon className="w-4 h-4 text-gold-400" />
                            {t("myAccount")}
                          </Link>
                        </div>

                        <div className="py-1">
                          <button
                            onClick={() => {
                              signOut();
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <LogOut className="w-4 h-4" />
                            {t("signOut")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-2 whitespace-nowrap">
                    <Link
                      href="/login"
                      className="text-xs text-ink-secondary hover:text-gold-400 font-semibold px-3 py-2 rounded-xl hover:bg-surface-subtle transition"
                    >
                      {t("signIn")}
                    </Link>
                    <Link
                      href="/b2b/register"
                      className="text-xs font-bold btn-gold-luxury px-3.5 py-2 rounded-xl transition whitespace-nowrap"
                    >
                      {t("b2bTrade")}
                    </Link>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-ink-secondary hover:text-gold-400 hover:bg-surface-subtle transition"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface border-b border-edge px-6 py-6 space-y-3 shadow-luxury">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold tracking-wider uppercase text-ink hover:text-gold-400 border-b border-edge"
          >
            {t("home")}
          </Link>
          <Link
            href="/catalog"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold tracking-wider uppercase text-ink hover:text-gold-400 border-b border-edge"
          >
            {t("catalog")}
          </Link>
          <Link
            href="/deals"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold tracking-wider uppercase text-gold-400 border-b border-edge"
          >
            {t("deals")}
          </Link>
          <Link
            href="/b2b/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold tracking-wider uppercase text-gold-400 border-b border-edge"
          >
            {t("b2bDesk")}
          </Link>
          <Link
            href="/shop-dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold tracking-wider uppercase text-ink hover:text-gold-400 border-b border-edge"
          >
            {t("sellers")}
          </Link>

          {!user && (
            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-xs font-bold border border-gold-500/40 rounded-xl text-gold-400"
              >
                {t("signIn")}
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/b2b/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 text-xs font-bold btn-gold-luxury rounded-xl"
                >
                  {t("b2bTrade")}
                </Link>
                <Link
                  href="/seller/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 text-xs font-bold border border-gold-500/50 text-gold-400 rounded-xl hover:bg-gold-500/10"
                >
                  {t("sellers")}
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
