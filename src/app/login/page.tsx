"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getDashboardPathForRole } from "@/lib/db";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Building2,
  Store,
  KeyRound,
} from "lucide-react";

function LoginFormContent() {
  const { signIn, sendPasswordReset, isConfigured, user, role, isLoading } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaChallengeMode, setMfaChallengeMode] = useState(
    searchParams.get("mfa") === "required"
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "suspended"
      ? "Your account has been suspended. Please contact Trio Dealers support."
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user && role && !mfaChallengeMode) {
      const target =
        redirectParam && redirectParam.startsWith("/")
          ? redirectParam
          : getDashboardPathForRole(role);
      router.replace(target);
    }
  }, [user, role, isLoading, redirectParam, router, mfaChallengeMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    if (mfaChallengeMode && user) {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find((f) => f.status === "verified");
      if (!totpFactor) {
        setSubmitting(false);
        setMfaChallengeMode(false);
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: totpCode.trim(),
      });
      setSubmitting(false);
      if (verifyErr) {
        setError("Invalid 6-digit authenticator code.");
        return;
      }
      const target =
        redirectParam && redirectParam.startsWith("/")
          ? redirectParam
          : getDashboardPathForRole(user.role);
      router.push(target);
      return;
    }

    const res = await signIn(
      email,
      password,
      turnstileToken,
      mfaChallengeMode ? totpCode : undefined
    );
    setSubmitting(false);

    if (res.mfaRequired && !res.error) {
      setMfaChallengeMode(true);
      setSuccessMsg("Enter your 6-digit authenticator code to complete sign-in.");
      return;
    }

    if (res.error) {
      setError(res.error);
      return;
    }

    const target =
      redirectParam && redirectParam.startsWith("/")
        ? redirectParam
        : getDashboardPathForRole(res.role);
    router.push(target);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const res = await sendPasswordReset(email, turnstileToken);
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setSuccessMsg(
      res.message ||
        "If an account exists for that email address, password recovery instructions have been dispatched."
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-canvas py-10 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Atelier Showcase Panel */}
        <div className="lg:col-span-5 luxury-card rounded-3xl p-8 sm:p-10 flex flex-col justify-between space-y-8 relative overflow-hidden">
          <div className="space-y-6 relative z-10">
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
                  Surat & Banaras Textile Guild
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Unified Role Access
              </span>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink leading-tight">
                One sign-in for Retail, Wholesale B2B & Partner Mills.
              </h1>
              <p className="text-xs text-ink-secondary leading-relaxed">
                You will be automatically directed to your authorized dashboard—Customer Account, B2B Trade Desk, Seller Inventory, Transporter Portal, or Admin Command.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-edge relative z-10 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-edge">
              <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Retail & Couture Buyers</p>
                <p className="text-[11px] text-ink-muted">
                  Track consignments, save delivery addresses, and download GST bills.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-edge">
              <Building2 className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Verified B2B Boutiques</p>
                <p className="text-[11px] text-ink-muted">
                  Unlock tiered MOQ bulk rates, RFQ mill quotes & Net-30 trade credit.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-edge">
              <Store className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Approved Seller Mills</p>
                <p className="text-[11px] text-ink-muted">
                  Manage catalog SKUs, sub-order dispatches, and NEFT payout settlements.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign-In / Recovery Card */}
        <div className="lg:col-span-7 luxury-card-elevated rounded-3xl p-7 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-heading font-bold text-ink">
              {forgotMode ? "Reset Your Password" : "Sign in to Trio Dealers"}
            </h2>
            <p className="text-xs text-ink-secondary">
              {forgotMode
                ? "Enter your account email and we will send a secure recovery link."
                : "Enter your registered email and password to continue."}
            </p>
          </div>

          {!isConfigured && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-xs space-y-1">
              <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Supabase Database Setup Required
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (or publishable key) in{" "}
                <code>.env.local</code> and execute{" "}
                <code>supabase/schema.sql</code> to enable live authentication.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {!forgotMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-secondary">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-gold-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {mfaChallengeMode && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-secondary">
                    Authenticator 2FA Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    placeholder="Enter 6-digit TOTP code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface-input border border-gold-500/60 text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none font-mono tracking-widest"
                  />
                </div>
              )}

              <TurnstileWidget onToken={setTurnstileToken} />

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? "Verifying..."
                    : mfaChallengeMode
                    ? "Verify 2FA & Continue"
                    : "Sign In"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Registered Email Address
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none transition"
                  />
                </div>
              </div>

              <TurnstileWidget onToken={setTurnstileToken} />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>
                    {submitting ? "Sending link..." : "Send Recovery Link"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="px-5 py-3.5 rounded-xl border border-edge bg-surface-subtle hover:bg-surface-input text-xs font-semibold text-ink transition"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Account Onboarding Links */}
          <div className="pt-5 border-t border-edge space-y-3 text-center sm:text-left">
            <p className="text-xs text-ink-secondary">
              New retail shopper?{" "}
              <Link
                href="/register"
                className="text-gold-400 font-bold hover:underline"
              >
                Create Customer Account
              </Link>
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs">
              <Link
                href="/b2b/register"
                className="text-gold-400 font-semibold hover:underline"
              >
                Register as B2B Buyer →
              </Link>
              <span className="text-edge-strong">•</span>
              <Link
                href="/seller/register"
                className="text-gold-400 font-semibold hover:underline"
              >
                Become a Seller Mill →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center bg-canvas text-xs text-ink-muted">
          Loading sign-in portal...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
