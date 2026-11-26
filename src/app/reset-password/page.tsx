"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { validatePasswordStrength } from "@/lib/security/password";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function ResetPasswordPage() {
  const { user, updatePassword, sendPasswordReset, isConfigured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.valid) {
      setError(pwdCheck.error || "Please choose a stronger password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await updatePassword(newPassword);
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setSuccessMsg("Password updated successfully! Redirecting to sign in...");
    setTimeout(() => {
      router.push("/login");
    }, 1800);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
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
    <div className="min-h-[calc(100vh-80px)] bg-canvas py-14 px-4 flex items-center justify-center">
      <div className="w-full max-w-md luxury-card-elevated rounded-3xl p-7 sm:p-9 space-y-6">
        <div className="text-center space-y-3">
          <div className="relative w-12 h-12 mx-auto rounded-full overflow-hidden border border-gold-500/60 shadow-gold bg-black">
            <Image
              src="/logo.png"
              alt="Trio Dealers"
              fill
              className="object-cover"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 border border-gold-500/30 text-gold-400 text-[11px] font-bold uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" />
            Account Recovery
          </div>
          <h1 className="text-2xl font-heading font-bold text-ink">
            {user ? "Set New Password" : "Recover Account Access"}
          </h1>
          <p className="text-xs text-ink-secondary">
            {user
              ? "Choose a strong new password for your Trio Dealers account."
              : "Request a password recovery link sent to your registered email address."}
          </p>
        </div>

        {!isConfigured && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Supabase connection is required in <code>.env.local</code> for password reset.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {user ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-secondary">
                New Password * (min 10 chars, upper/lower/digit/symbol)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
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
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>
                {submitting ? "Updating Password..." : "Update Password"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-secondary">
                Registered Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-input border border-edge text-sm text-ink placeholder:text-ink-muted focus:border-gold-500 outline-none"
                />
              </div>
            </div>

            <TurnstileWidget onToken={setTurnstileToken} />

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-gold-luxury py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{submitting ? "Sending..." : "Send Recovery Email"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-edge text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
