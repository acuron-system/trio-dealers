"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  Building2,
  User,
  MapPin,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function B2BRegisterPage() {
  const { signUpB2B } = useAuth();

  const [form, setForm] = useState({
    businessName: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    gstin: "",
    pan: "",
    address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    businessType: "Boutique / Fashion Retailer",
  });

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signUpB2B({
      business_name: form.businessName,
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
            <Building2 className="w-3.5 h-3.5" /> Wholesale B2B Trade Desk
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Apply for Trio B2B Wholesale Trade Account
          </h1>
          <p className="text-xs text-ink-secondary max-w-md mx-auto">
            Tailors, fashion boutiques, resellers, and garment manufacturers: unlock tiered wholesale volume pricing, GST input credits, and Net 30 trade credit.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-3xl luxury-card-elevated border border-gold-500/40 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/40 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-heading font-bold text-ink">
              B2B Trade Application Under Verification
            </h2>
            <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
              Thank you for applying with{" "}
              <strong className="text-gold-400">{form.businessName}</strong>. Our commercial credit verification desk reviews GSTIN and business trade certificates within 4-8 business hours.
            </p>
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge text-xs text-ink-secondary text-left space-y-2">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-gold-400" /> What unlocks upon approval:
              </p>
              <p>
                • <strong className="text-ink">Volume Wholesale Slabs:</strong> Up to 45% discount on sarees, cotton cuts, and raw fabrics.
              </p>
              <p>
                • <strong className="text-ink">Trade Credit Limits:</strong> Pre-approved credit limits (up to ₹1,00,000) with Net 15/30 repayment.
              </p>
              <p>
                • <strong className="text-ink">Custom RFQs:</strong> Direct negotiation with mills for 200+ meter lots.
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
                <Building2 className="w-4 h-4" /> 1. Business & Tax Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Registered Business Name{" "}
                    <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.businessName}
                    onChange={(e) =>
                      setForm({ ...form, businessName: e.target.value })
                    }
                    placeholder="e.g. Priya Boutiques Pvt Ltd"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Business Entity Type
                  </label>
                  <select
                    value={form.businessType}
                    onChange={(e) =>
                      setForm({ ...form, businessType: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none transition"
                  >
                    <option value="Boutique / Fashion Retailer">
                      Boutique / Fashion Retailer
                    </option>
                    <option value="Garment Manufacturer / Tailor">
                      Garment Manufacturer / Tailor
                    </option>
                    <option value="Cloth Wholesaler / Reseller">
                      Cloth Wholesaler / Reseller
                    </option>
                    <option value="Export & Buying House">
                      Export & Buying House
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    GSTIN (for B2B Tax Invoice){" "}
                    <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.gstin}
                    onChange={(e) =>
                      setForm({ ...form, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="27AABCP8921R1Z3"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs uppercase font-mono focus:border-gold-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={form.pan}
                    onChange={(e) =>
                      setForm({ ...form, pan: e.target.value.toUpperCase() })
                    }
                    placeholder="AABCP8921R"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs uppercase font-mono focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> 2. Purchasing Officer & Contact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Contact Person <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="Priya Agarwal"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Official Email <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="buyer@boutique.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Phone (WhatsApp) <span className="text-gold-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+91 98765 00000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                  Set Account Password <span className="text-gold-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                />
              </div>
            </div>

            {/* Section 3 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 border-b border-edge pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> 3. Commercial Delivery Warehouse
              </h3>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                  Warehouse / Store Address{" "}
                  <span className="text-gold-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Plot 88, Commercial Complex, Jubilee Hills"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
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
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, pincode: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading
                ? "Verifying Trade Profile..."
                : "Submit B2B Account Application"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
