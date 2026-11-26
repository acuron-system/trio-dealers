"use client";

import React, { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatDateTime } from "@/lib/utils";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      const [{ data: audit }, { data: flags }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(80),
        supabase.from("fraud_flags").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      setLogs(audit || []);
      setFraudFlags(flags || []);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-gold-500" />
            Security Audit Ledger &amp; Fraud Monitor
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Append-only audit trail covering authentication events, role updates, payments, returns, and document uploads.
          </p>
        </div>

        {fraudFlags.length > 0 && (
          <div className="luxury-card rounded-2xl p-5 border border-red-500/35 space-y-3 text-xs">
            <h2 className="font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Open Fraud Risk Flags ({fraudFlags.length})
            </h2>
            {fraudFlags.map((f) => (
              <div key={f.id} className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 flex justify-between">
                <span>
                  {f.flag_type} • Severity: {f.severity}
                </span>
                <span className="font-mono text-ink-muted">{f.status}</span>
              </div>
            ))}
          </div>
        )}

        <div className="luxury-card rounded-2xl overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-surface-subtle border-b border-edge">
              <tr>
                <th className="p-3.5 font-bold uppercase text-ink-muted">Timestamp</th>
                <th className="p-3.5 font-bold uppercase text-ink-muted">Action</th>
                <th className="p-3.5 font-bold uppercase text-ink-muted">Role</th>
                <th className="p-3.5 font-bold uppercase text-ink-muted">Entity</th>
                <th className="p-3.5 font-bold uppercase text-ink-muted">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink-muted">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="p-3.5 font-mono text-ink-muted whitespace-nowrap">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="p-3.5 font-semibold text-gold-400">{l.action}</td>
                    <td className="p-3.5 uppercase">{l.actor_role || "system"}</td>
                    <td className="p-3.5 font-mono text-ink">
                      {l.entity_type} {l.entity_id ? `(${String(l.entity_id).slice(0, 8)})` : ""}
                    </td>
                    <td className="p-3.5 font-mono text-ink-muted">{l.ip_address || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

