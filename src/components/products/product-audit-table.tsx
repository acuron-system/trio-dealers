"use client";

import React from "react";
import { ProductAuditLog } from "@/types/database";
import { formatDateTime } from "@/lib/utils";
import { History, ArrowRight } from "lucide-react";

interface ProductAuditTableProps {
  logs: ProductAuditLog[];
  showShop?: boolean;
  loading?: boolean;
}

function getActionBadgeClass(action: string) {
  switch (action) {
    case "approved":
    case "published":
    case "restored":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/35";
    case "rejected":
    case "deleted":
      return "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/35";
    case "changes_requested":
    case "unpublished":
    case "archived":
      return "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/35";
    default:
      return "bg-surface-subtle text-ink-secondary border-edge";
  }
}

export function ProductAuditTable({
  logs,
  showShop = false,
  loading = false,
}: ProductAuditTableProps) {
  if (loading) {
    return (
      <div className="p-8 rounded-3xl luxury-card text-center text-xs text-ink-muted">
        Loading product governance audit trail...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-10 rounded-3xl luxury-card text-center space-y-2">
        <History className="w-8 h-8 text-ink-muted mx-auto" />
        <p className="text-sm font-semibold text-ink">No audit entries yet</p>
        <p className="text-xs text-ink-muted">
          Product creations, moderation decisions, archives, and deletions will be recorded here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="luxury-card rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle border-b border-edge text-ink-secondary uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Timestamp</th>
              <th className="py-3.5 px-4 font-semibold">Product</th>
              {showShop && (
                <th className="py-3.5 px-4 font-semibold">Seller Mill</th>
              )}
              <th className="py-3.5 px-4 font-semibold">Actor</th>
              <th className="py-3.5 px-4 font-semibold">Action</th>
              <th className="py-3.5 px-4 font-semibold">Transition</th>
              <th className="py-3.5 px-4 font-semibold">Reason / Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge text-ink-secondary">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-surface-subtle/50 transition">
                <td className="py-3.5 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </td>
                <td className="py-3.5 px-4 font-semibold text-ink">
                  {log.product_name}
                </td>
                {showShop && (
                  <td className="py-3.5 px-4 text-ink-secondary">
                    {log.shop?.shop_name || "House Stock"}
                  </td>
                )}
                <td className="py-3.5 px-4">
                  <span className="font-medium text-ink">
                    {log.actor?.full_name || "System"}
                  </span>
                  <span className="block text-[10px] uppercase text-ink-muted">
                    {log.actor_role}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${getActionBadgeClass(
                      log.action
                    )}`}
                  >
                    {log.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                  {log.previous_status || "—"}
                  <ArrowRight className="w-3 h-3 inline mx-1 text-gold-400" />
                  <span className="text-ink font-semibold">
                    {log.new_status || "—"}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-ink-secondary max-w-xs">
                  {log.reason || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
