"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
} from "lucide-react";

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at?: string;
}

export default function AdminSecurityPage() {
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [aal, setAal] = useState<{ currentLevel: string | null; nextLevel: string | null }>({
    currentLevel: null,
    nextLevel: null,
  });
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMfaState = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: factorData }, { data: aalData }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      setFactors((factorData?.totp || []) as TotpFactor[]);
      setAal({
        currentLevel: aalData?.currentLevel || null,
        nextLevel: aalData?.nextLevel || null,
      });
    } catch (err: any) {
      setError(err?.message || "Unable to inspect MFA status.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMfaState();
  }, [loadMfaState]);

  const handleEnroll = async () => {
    setError(null);
    setMessage(null);
    setEnrolling(true);

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Trio Dealers Admin Authenticator",
    });

    setEnrolling(false);

    if (enrollError || !data) {
      setError(enrollError?.message || "Failed to initialize TOTP enrollment.");
      return;
    }

    setPendingFactorId(data.id);
    setQrCodeSvg(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
  };

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId || !verifyCode.trim()) return;
    setError(null);
    setMessage(null);

    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: verifyCode.trim(),
    });

    if (verifyErr) {
      setError(verifyErr.message);
      return;
    }

    setQrCodeSvg(null);
    setTotpSecret(null);
    setPendingFactorId(null);
    setVerifyCode("");
    setMessage("TOTP Two-Factor Authentication is now active and verified (AAL2).");
    await loadMfaState();
  };

  const handleUnenroll = async (factorId: string) => {
    setError(null);
    setMessage(null);
    const { error: removeErr } = await supabase.auth.mfa.unenroll({ factorId });
    if (removeErr) {
      setError(removeErr.message);
      return;
    }
    setMessage("Authenticator factor removed.");
    await loadMfaState();
  };

  const handleSignOutAllSessions = async () => {
    await fetch("/api/auth/logout-all", { method: "POST" });
    await signOut();
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-gold-500" />
              Admin Security & 2FA Controls
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Manage TOTP two-factor authentication, session revocation, and AAL2 assurance for {user?.email || "Admin"}.
            </p>
          </div>
          <button
            onClick={handleSignOutAllSessions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out All Devices
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="luxury-card rounded-2xl p-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-ink-muted font-bold">
              Current Session Assurance
            </p>
            <p className="text-2xl font-heading font-extrabold text-gold-400">
              {loading ? "Checking..." : (aal.currentLevel || "aal1").toUpperCase()}
            </p>
            <p className="text-xs text-ink-muted">
              AAL2 is automatically required on all `/admin` and payout endpoints once a TOTP authenticator is verified.
            </p>
          </div>

          <div className="luxury-card rounded-2xl p-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-ink-muted font-bold">
              Active TOTP Factors
            </p>
            <p className="text-2xl font-heading font-extrabold text-ink">
              {factors.filter((f) => f.status === "verified").length}
            </p>
            <p className="text-xs text-ink-muted">
              Compatible with Google Authenticator, Authy, 1Password, or Apple Passwords.
            </p>
          </div>
        </div>

        <div className="luxury-card rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-heading font-bold text-ink flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gold-500" />
                Authenticator App (TOTP 2FA)
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Required protection before modifying user roles, seller payouts, or platform settings.
              </p>
            </div>
            {!qrCodeSvg && (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="btn-gold-luxury px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider disabled:opacity-60"
              >
                {enrolling ? "Generating..." : "+ Enroll New Authenticator"}
              </button>
            )}
          </div>

          {qrCodeSvg && (
            <div className="rounded-2xl border border-gold-500/40 bg-elevated p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl">
                <div
                  className="w-44 h-44"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              </div>

              <form onSubmit={handleVerifyEnrollment} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-ink">1. Scan QR code in your authenticator</p>
                  <p className="text-xs text-ink-muted">
                    Or enter this manual secret key:
                  </p>
                  <code className="block text-[11px] bg-canvas border border-edge rounded-lg px-3 py-2 font-mono text-gold-400 break-all">
                    {totpSecret}
                  </code>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                    2. Enter 6-digit verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-field border border-edge-strong text-sm text-ink focus:outline-none focus:border-gold-500 font-mono tracking-widest"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="btn-gold-luxury px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Verify & Activate 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQrCodeSvg(null);
                      setTotpSecret(null);
                      setPendingFactorId(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-edge text-xs font-semibold text-ink-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {factors.length > 0 && (
            <div className="divide-y divide-edge border border-edge rounded-xl overflow-hidden">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 bg-surface"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {factor.friendly_name || "TOTP Authenticator"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Status:{" "}
                      <span
                        className={
                          factor.status === "verified"
                            ? "text-emerald-400 font-semibold"
                            : "text-amber-400 font-semibold"
                        }
                      >
                        {factor.status}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnenroll(factor.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
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

