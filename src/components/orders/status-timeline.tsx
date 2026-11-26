"use client";

import React from "react";
import { OrderStatus, OrderStatusHistory } from "@/types/database";
import {
  Check,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface StatusTimelineProps {
  currentStatus: OrderStatus;
  history?: OrderStatusHistory[];
}

const FLOW_STEPS: OrderStatus[] = [
  "Placed",
  "Confirmed",
  "Packed",
  "Assigned to Transporter",
  "Out for Delivery",
  "Delivered",
];

export function StatusTimeline({
  currentStatus,
  history = [],
}: StatusTimelineProps) {
  const isCancelled = currentStatus === "Cancelled" || currentStatus === "cancelled";
  const isReturned = currentStatus === "Returned" || currentStatus === "refunded";

  if (isCancelled || isReturned) {
    return (
      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/35 flex items-center gap-3">
        {isCancelled ? (
          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
        ) : (
          <RotateCcw className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <div>
          <h4 className="text-sm font-semibold text-ink">
            Order Status:{" "}
            <span className="text-red-600 dark:text-red-400 capitalize">
              {currentStatus}
            </span>
          </h4>
          <p className="text-xs text-ink-secondary mt-0.5">
            {isCancelled
              ? "This order has been cancelled. If payment was made, refund will be processed within 5-7 business days."
              : "This order has been returned to Trio Dealers warehouse."}
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = Math.max(0, FLOW_STEPS.indexOf(currentStatus));

  const getStepIcon = (index: number) => {
    if (index === 0) return <Clock className="w-4 h-4" />;
    if (index === 1) return <Check className="w-4 h-4" />;
    if (index === 2) return <Package className="w-4 h-4" />;
    if (index === 3) return <Truck className="w-4 h-4" />;
    if (index === 4) return <Truck className="w-4 h-4 animate-bounce" />;
    return <CheckCircle2 className="w-4 h-4" />;
  };

  return (
    <div className="py-4">
      {/* Horizontal Stepper for medium+ screens */}
      <div className="hidden md:flex items-center justify-between relative">
        <div className="absolute top-5 left-6 right-6 h-0.5 bg-edge-strong -z-0" />
        <div
          className="absolute top-5 left-6 h-0.5 bg-gold-500 transition-all duration-500 -z-0"
          style={{
            width: `${Math.max(
              0,
              (currentIndex / (FLOW_STEPS.length - 1)) * 100
            )}%`,
          }}
        />

        {FLOW_STEPS.map((step, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step} className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCurrent
                    ? "bg-gold-500 text-black font-bold shadow-gold-lg ring-4 ring-gold-500/20"
                    : isDone
                    ? "bg-gold-500/15 text-gold-400 border border-gold-500/50"
                    : "bg-surface-subtle text-ink-muted border border-edge"
                }`}
              >
                {getStepIcon(idx)}
              </div>
              <span
                className={`text-[11px] mt-2 font-medium text-center max-w-[85px] leading-tight ${
                  isCurrent
                    ? "text-gold-400 font-bold"
                    : isDone
                    ? "text-ink"
                    : "text-ink-muted"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Vertical Stepper for mobile */}
      <div className="md:hidden space-y-4">
        {FLOW_STEPS.map((step, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step} className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isCurrent
                    ? "bg-gold-500 text-black shadow-gold"
                    : isDone
                    ? "bg-gold-500/15 text-gold-400 border border-gold-500/40"
                    : "bg-surface-subtle text-ink-muted border border-edge"
                }`}
              >
                {getStepIcon(idx)}
              </div>
              <div className="flex-1">
                <p
                  className={`text-xs font-semibold ${
                    isCurrent
                      ? "text-gold-400"
                      : isDone
                      ? "text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {step}
                </p>
                {isCurrent && (
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Current stage of your shipment
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* History log entries if available */}
      {history.length > 0 && (
        <div className="mt-6 pt-4 border-t border-edge">
          <h5 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
            Activity Log
          </h5>
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="text-xs flex items-start justify-between gap-4 text-ink-secondary"
              >
                <div>
                  <span className="font-medium text-ink">{h.status}:</span>{" "}
                  <span>{h.note}</span>
                </div>
                <span className="shrink-0 text-[10px] text-ink-muted font-mono">
                  {formatDateTime(h.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
