"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  Store,
  Mail,
  MapPin,
  CreditCard,
  ArrowRight,
  AlertCircle,
  Clock,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

export default function SellerRegisterPage() {
  const { signUpShop } = useAuth();

  const [form, setForm] = useState({
    shopName: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    gstin: "",
    pan: "",
    address: "",
    city: "Surat",
    state: "Gujarat",
    pincode: "395002",
    bankName: "",
    bankAccountNo: "",
    bankIfsc: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docUploaded, setDocUploaded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signUpShop({
      shop_name: form.shopName,
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      password: form.password,
      gstin: form.gstin,
      pan: form.pan,
      address: form.address,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      bank_name: form.bankName,
      bank_account_no: form.bankAccountNo,
      bank_ifsc: form.bankIfsc,
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
      <div className="max-w-2xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3">
          <div className="relative w-14 h-14 mx-auto rounded-full overflow-hidden border border-gold-500/50 shadow-gold bg-black">
            <Image src="/logo.png" alt="Trio Dealers" fill className="object-cover" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-semibold uppercase tracking-wider">
            <Store className="w-3.5 h-3.5" /> Seller & Mill Partner Onboarding
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Sell on Trio Dealers Marketplace
          </h1>
          <p className="text-xs text-ink-secondary max-w-md mx-auto">
            Connect your textile mill, boutique, or weaving workshop with thousands of retail customers and verified B2B buyers across India.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-3xl luxury-card-elevated border border-gold-500/40 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/40 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-ink">
              Seller KYC Application Submitted
            </h2>
            <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
              Thank you for registering{" "}
              <strong className="text-gold-400">{form.shopName}</strong>. Our compliance and merchant operations team in Surat will verify your GSTIN and bank details within 1 business day.
            </p>
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge text-xs text-ink-secondary text-left space-y-2">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-gold-400" /> Seller Verification Process:
              </p>
              <p>
                1. <strong className="text-ink">GSTIN & PAN Validation:</strong> Automated check against MCA/GST portal.
              </p>
              <p>
                2. <strong className="text-ink">Bank Account Verification:</strong> Penny drop verification for automated payouts.
              </p>
              <p>
                3. <strong className="text-ink">Storefront Activation:</strong> Once approved, start listing products and setting wholesale slabs.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider"
              >
                Proceed to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-3xl luxury-card-elevated border border-gold-500/35 space-y-6"
          >
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <Store className="w-4 h-4" /> 1. Mill / Shop Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Shop / Business Name <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="e.g. Rajesh Silk Mills"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Owner / Representative Name <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Rajesh Patel"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    GSTIN <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.gstin}
                    onChange={(e) =>
                      setForm({ ...form, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. 27AABCT3518Q1ZP"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs uppercase font-mono focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    PAN Number <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.pan}
                    onChange={(e) =>
                      setForm({ ...form, pan: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. AABCT3518Q"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs uppercase font-mono focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" /> 2. Login & Contact Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Official Email <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="seller@mills.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Mobile (WhatsApp) <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 00000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Portal Password <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> 3. Dispatch Depot / Mill Address
              </h3>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                  Address Line 1 <span className="text-gold-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Shop 12-14, Millennium Textile Market, Ring Road"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Pincode
                  </label>
                  <input
                    type="text"
                    required
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> 4. Bank Account for Sales Settlement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="e.g. HDFC Bank"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={form.bankAccountNo}
                    onChange={(e) =>
                      setForm({ ...form, bankAccountNo: e.target.value })
                    }
                    placeholder="50100234567890"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono focus:border-gold-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    required
                    value={form.bankIfsc}
                    onChange={(e) =>
                      setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })
                    }
                    placeholder="HDFC0001234"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono uppercase focus:border-gold-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-edge bg-surface-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UploadCloud className="w-5 h-5 text-gold-400" />
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      GST Certificate / Trade License (PDF/JPG)
                    </p>
                    <p className="text-[10px] text-ink-secondary">
                      Attach verification proof (Max 5MB)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDocUploaded(!docUploaded)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    docUploaded
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/35"
                      : "bg-surface border border-edge text-ink-secondary hover:text-ink"
                  }`}
                >
                  {docUploaded ? "Uploaded ✓" : "Upload File"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Registering Mill..." : "Submit Seller KYC Application"}
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[11px] text-ink-secondary">
              Already registered?{" "}
              <Link
                href="/login"
                className="text-gold-400 hover:underline font-semibold"
              >
                Sign In to Seller Dashboard
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
