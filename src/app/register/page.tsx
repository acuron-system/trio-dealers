"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { validatePasswordStrength } from "@/lib/security/password";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

export default function RegisterPage() {
  const { signUp, isConfigured } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      setError(pwdCheck.error || "Please choose a stronger password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    const res = await signUp({
      email,
      password,
      full_name: fullName,
      phone: phone || undefined,
      turnstileToken,
    });
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.needsEmailConfirmation) {
      setNeedsConfirmation(true);
      return;
    }

    router.push("/account");
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-canvas py-10 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Editorial Benefits Panel */}
        <div className="lg:col-span-5 luxury-card rounded-3xl p-8 sm:p-10 flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gold-500/60 shadow-gold shrink-0 bg-black">
                <Image
                  src="/logo.png"
                  alt="Trio Dealers"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-royal font-extrabold text-lg tracking-wider text-gold-gradient">
                  TRIO DEALERS
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-semibold">
                  Retail & Bespoke Textile Membership
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Customer Registration
              </span>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink leading-tight">
                Curated sarees, suiting & fabrics direct from verified weavers.
              </h1>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Join Trio Dealers to save favorite fabric weaves, manage multiple shipping addresses, and download official GST consignment invoices.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-edge text-xs">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-edge">
              <Truck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">
                  Free Insured Freight Above ₹1,999
                </p>
                <p className="text-[11px] text-ink-muted">
                  Live two-leg parcel tracking with OTP handover security.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-edge">
              <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">
                  Authenticity Checked by Trio Chamber
                </p>
                <p className="text-[11px] text-ink-muted">
                  Every silk and Giza cotton weave is KYC-sourced directly from mills.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="lg:col-span-7 luxury-card-elevated rounded-3xl p-7 sm:p-10 flex flex-col justify-center space-y-6">
          {needsConfirmation ? (
            <div className="text-center py-8 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-heading font-bold text-ink">
                  Verify Your Email Address
                </h2>
                <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
                  We sent a verification link to{" "}
                  <strong className="text-ink">{email}</strong>. Click the link
                  in your inbox to activate your Trio Dealers account.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider"
              >
                Go to Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-heading font-bold text-ink">
                  Create Customer Account
                </h2>
                <p className="text-xs text-ink-secondary">
                  Fill in your contact details to begin shopping retail or custom fabric cuts.
                </p>
              </div>

              {!isConfigured && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Supabase credentials are not configured in <code>.env.local</code> yet.
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Aarav Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Mobile / WhatsApp (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-secondary">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Password * (min 10 chars, upper/lower/digit/symbol)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={10}
                        placeholder="Create strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={10}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <TurnstileWidget onToken={setTurnstileToken} />

                <p className="text-[11px] text-ink-muted">
                  By creating an account, you consent to essential order/GST processing under our DPDP Privacy Policy.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>
                    {submitting ? "Creating Account..." : "Create Retail Account"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-edge space-y-2 text-xs text-ink-secondary">
                <p>
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="text-gold-400 font-bold hover:underline"
                  >
                    Sign In
                  </Link>
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <Link
                    href="/b2b/register"
                    className="text-gold-400 hover:underline font-semibold"
                  >
                    Register Wholesale Account (B2B) →
                  </Link>
                  <Link
                    href="/seller/register"
                    className="text-gold-400 hover:underline font-semibold"
                  >
                    Onboard Textile Mill / Shop →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
