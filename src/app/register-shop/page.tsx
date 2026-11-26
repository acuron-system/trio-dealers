"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  Store,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  FileText,
  ArrowRight,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function RegisterShopPage() {
  const { signUpShop } = useAuth();

  const [form, setForm] = useState({
    shopName: "",
    fullName: "",
    gstNo: "",
    email: "",
    phone: "",
    password: "",
    address: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signUpShop({
      shop_name: form.shopName,
      full_name: form.fullName,
      gst_no: form.gstNo,
      email: form.email,
      phone: form.phone,
      password: form.password,
      address: form.address,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSubmitted(true);
    }
  };

  return (
    <div className="bg-canvas py-12 sm:py-16">
      <div className="max-w-xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3">
          <div className="relative w-14 h-14 mx-auto rounded-full overflow-hidden border border-gold-500/50 shadow-gold bg-black">
            <Image src="/logo.png" alt="Trio Dealers" fill className="object-cover" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-semibold uppercase tracking-wider">
            <Store className="w-3.5 h-3.5" /> B2B Commercial Partner
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Register Wholesale Shop
          </h1>
          <p className="text-xs text-ink-secondary max-w-sm mx-auto">
            Tailors, fashion boutiques, and retailers: gain direct factory prices, bulk tiers, and freight consignment dispatch.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-3xl luxury-card-elevated border border-gold-500/40 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/40 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-ink">
              Application Submitted for Verification
            </h2>
            <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
              Thank you for registering{" "}
              <strong className="text-gold-400">{form.shopName}</strong>. As part of our commercial B2B protocol, an admin reviews each wholesale application within 1 business day.
            </p>
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge text-xs text-ink-secondary text-left space-y-1">
              <p className="font-semibold text-ink">What happens next?</p>
              <p>1. Our compliance team verifies your shop trade details.</p>
              <p>2. Once approved, you will receive an email/WhatsApp confirmation.</p>
              <p>3. You can then sign in to access wholesale prices and bulk ordering.</p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider"
              >
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
              <Clock className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Approval Notice:</span> New wholesale accounts require administrator approval before wholesale login and catalog access are granted. You will be notified once activated.
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8 rounded-3xl luxury-card-elevated space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-ink-secondary font-medium">
                  Business / Shop Name *
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                  <input
                    type="text"
                    required
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="e.g. Rajesh Textile & Boutique"
                    className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-ink-secondary font-medium">
                    Contact Person Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="e.g. Rajesh Patel"
                      className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-ink-secondary font-medium">
                    GST Number (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                    <input
                      type="text"
                      value={form.gstNo}
                      onChange={(e) => setForm({ ...form, gstNo: e.target.value })}
                      placeholder="e.g. 24AAACA1234D1Z5"
                      className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted uppercase focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-ink-secondary font-medium">
                    Business Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="shop@example.com"
                      className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-ink-secondary font-medium">
                    Phone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 00000"
                      className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-ink-secondary font-medium">
                  Shop / Delivery Address *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                  <textarea
                    required
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Market name, street, city, state, pincode"
                    className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-ink-secondary font-medium">
                  Account Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className="w-full bg-surface-input border border-edge rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading
                  ? "Submitting Application..."
                  : "Submit Wholesale Registration"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="text-center text-xs text-ink-secondary">
              Already approved?{" "}
              <Link
                href="/login"
                className="text-gold-400 hover:underline font-semibold"
              >
                Sign In to B2B Portal
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
