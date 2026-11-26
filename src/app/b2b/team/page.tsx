"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatINR } from "@/lib/utils";
import { ArrowLeft, Users, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";

interface B2BMemberRow {
  id: string;
  user_id?: string | null;
  invited_email: string;
  member_role: "owner" | "approver" | "buyer";
  spend_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export default function B2BTeamPage() {
  const { user, isLoading: authLoading } = useAuth();
  const b2bAccount = user?.b2b_account;

  const [members, setMembers] = useState<B2BMemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"buyer" | "approver">("buyer");
  const [spendLimit, setSpendLimit] = useState("50000");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!b2bAccount || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("b2b_members")
      .select("*")
      .eq("b2b_account_id", b2bAccount.id)
      .order("created_at", { ascending: false });
    setMembers((data || []) as B2BMemberRow[]);
    setLoading(false);
  }, [b2bAccount]);

  useEffect(() => {
    if (!authLoading) loadMembers();
  }, [authLoading, loadMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!b2bAccount || !inviteEmail.trim()) return;
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("b2b_members")
      .insert({
        b2b_account_id: b2bAccount.id,
        invited_email: inviteEmail.trim().toLowerCase(),
        member_role: memberRole,
        spend_limit: spendLimit ? Number(spendLimit) : null,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }

    setMembers((prev) => [data as B2BMemberRow, ...prev]);
    setInviteEmail("");
    setMsg({ ok: true, text: "Team procurement buyer added." });
  };

  const toggleActive = async (member: B2BMemberRow) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("b2b_members")
      .update({ is_active: !member.is_active })
      .eq("id", member.id)
      .select("*")
      .single();
    if (data) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? (data as B2BMemberRow) : m))
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link
            href="/b2b/dashboard"
            className="text-xs font-semibold text-gold-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to B2B Trade Desk
          </Link>
          <h1 className="text-2xl font-heading font-extrabold text-ink flex items-center gap-2">
            <Users className="w-6 h-6 text-gold-400" />
            B2B Procurement Team &amp; Approval Limits
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Authorize merchandisers and branch buyers under {b2bAccount?.business_name || "your wholesale account"} with per-order spending limits.
          </p>
        </div>

        {msg && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
              msg.ok
                ? "bg-emerald-500/10 border border-emerald-500/35 text-emerald-400"
                : "bg-red-500/10 border border-red-500/35 text-red-400"
            }`}
          >
            {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{msg.text}</span>
          </div>
        )}

        <form
          onSubmit={handleAddMember}
          className="luxury-card rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs"
        >
          <div className="md:col-span-2">
            <label className="block font-semibold text-ink-secondary mb-1">
              Teammate Email *
            </label>
            <input
              type="email"
              required
              placeholder="buyer@boutique.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Role</label>
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink"
            >
              <option value="buyer">Buyer (Needs Approval Over Limit)</option>
              <option value="approver">Approver</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink-secondary mb-1">
              Spend Limit (INR)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-edge text-ink font-mono"
              />
              <button
                type="submit"
                disabled={!b2bAccount}
                className="btn-gold-luxury px-4 py-2.5 rounded-xl inline-flex items-center gap-1 shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </form>

        <div className="luxury-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-6 text-xs text-ink-muted">Loading team members...</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              No additional procurement buyers added yet.
            </div>
          ) : (
            <div className="divide-y divide-edge">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <p className="font-bold text-ink">{m.invited_email}</p>
                    <p className="text-ink-muted capitalize">
                      Role: <span className="text-gold-400 font-semibold">{m.member_role}</span> •
                      Spend Cap: {m.spend_limit ? formatINR(m.spend_limit) : "Unlimited"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(m)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                      m.is_active
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/35 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {m.is_active ? "Active" : "Suspended"}
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

