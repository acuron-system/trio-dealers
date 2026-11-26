"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Store,
  Building2,
  Users,
  BarChart3,
  CreditCard,
  ShieldCheck,
  Lock,
  Layout,
  FileText,
  Zap,
  RotateCcw,
  LifeBuoy,
  ShieldAlert,
  Wallet,
} from "lucide-react";

export function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
    { href: "/admin/shops", label: "Shops KYC", icon: Store },
    { href: "/admin/b2b", label: "B2B Credit", icon: Building2 },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/returns", label: "Returns", icon: RotateCcw },
    { href: "/admin/payouts", label: "Payouts", icon: CreditCard },
    { href: "/admin/finance", label: "Finance", icon: Wallet },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: Layers },
    { href: "/admin/homepage", label: "Homepage", icon: Layout },
    { href: "/admin/cms", label: "CMS & Settings", icon: FileText },
    { href: "/admin/marketing", label: "Flash & Coupons", icon: Zap },
    { href: "/admin/support", label: "Support", icon: LifeBuoy },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/reports", label: "GST Reports", icon: BarChart3 },
    { href: "/admin/audit", label: "Audit Log", icon: ShieldAlert },
    { href: "/admin/security", label: "2FA Security", icon: Lock },
  ];

  return (
    <div className="border-b border-edge bg-surface/90 backdrop-blur-md overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                isActive
                  ? "border-gold-500 text-gold-400 bg-gold-500/10 font-bold"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-edge-strong"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
