"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTransporterDeliveries } from "@/lib/db";
import { Delivery, DeliveryStatus } from "@/types/database";
import { formatINR } from "@/lib/utils";
import {
  Truck,
  CheckCircle2,
  DollarSign,
  Package,
  Camera,
  X,
  KeyRound,
  Store,
  User,
  Check,
  Phone,
  Navigation,
  CalendarClock,
} from "lucide-react";

export default function TransporterPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [codCollected, setCodCollected] = useState(false);
  const [failureReason, setFailureReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  useEffect(() => {
    async function loadTasks() {
      if (!user || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const rows = await fetchTransporterDeliveries(
        supabase,
        user.role === "admin" ? undefined : user.id
      );
      setDeliveries(rows);
      setLoading(false);
    }
    if (!authLoading) {
      loadTasks();
    }
  }, [user, authLoading]);

  const activeTasks = deliveries.filter(
    (d) => d.status !== "delivered" && d.status !== "failed"
  );
  const completedTasks = deliveries.filter(
    (d) => d.status === "delivered" || d.status === "failed"
  );

  const totalCodCollected = deliveries
    .filter((d) => d.cod_collected)
    .reduce((sum, d) => sum + Number(d.cod_amount), 0);

  const pendingCod = deliveries
    .filter((d) => d.leg === "delivery" && d.cod_amount > 0 && !d.cod_collected)
    .reduce((sum, d) => sum + Number(d.cod_amount), 0);

  const handleOpenAction = (del: Delivery) => {
    setSelectedDelivery(del);
    setEnteredOtp("");
    setOtpError(false);
    setProofFile(null);
    setCodCollected(del.cod_collected);
    setFailureReason("");
  };

  const handleConfirmTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    const action: "complete" | "fail" | "reschedule" = rescheduleDate
      ? "reschedule"
      : failureReason
      ? "fail"
      : "complete";

    if (
      action === "complete" &&
      selectedDelivery.otp_code &&
      enteredOtp.trim() !== selectedDelivery.otp_code
    ) {
      setOtpError(true);
      return;
    }

    let uploadedProofRef: string | null = null;
    if (proofFile) {
      const fd = new FormData();
      fd.append("bucket", "delivery-proofs");
      fd.append("file", proofFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (uploadRes.ok && (uploadData.privateRef || uploadData.path)) {
        uploadedProofRef = uploadData.privateRef || uploadData.path;
      }
    }

    const res = await fetch("/api/transporter/deliveries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryId: selectedDelivery.id,
        action,
        otpCode: enteredOtp.trim() || undefined,
        proofRef: uploadedProofRef || undefined,
        codCollected: selectedDelivery.cod_amount > 0 ? codCollected : false,
        reason: failureReason || undefined,
        rescheduleAt: rescheduleDate ? new Date(rescheduleDate).toISOString() : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setOtpError(res.status === 400);
      return;
    }

    const nextStatus: DeliveryStatus = data.delivery?.status || "delivered";
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === selectedDelivery.id
          ? {
              ...d,
              status: nextStatus,
              cod_collected:
                selectedDelivery.cod_amount > 0 ? codCollected : false,
              failure_reason: failureReason || null,
              proof_url: uploadedProofRef || d.proof_url,
            }
          : d
      )
    );

    const msg =
      action === "reschedule"
        ? `Delivery rescheduled for ${rescheduleDate}.`
        : action === "fail"
        ? `Delivery marked failed: ${failureReason}`
        : selectedDelivery.leg === "pickup"
        ? `Consignment picked up from ${selectedDelivery.sub_order?.shop?.shop_name || "Mill"}!`
        : `Consignment delivered! ${codCollected ? "COD cash recorded." : ""}`;

    setSuccessToast(msg);
    setRescheduleDate("");
    setSelectedDelivery(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading assigned logistics runs...
      </div>
    );
  }

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="rounded-3xl p-6 sm:p-8 luxury-card-elevated border border-gold-500/35 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
              <Truck className="w-3.5 h-3.5" /> Two-Leg Transport Partner Flow
            </div>
            <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
              Logistics Dispatch Portal
            </h1>
            <p className="text-xs text-ink-secondary max-w-lg">
              Leg 1: Pick up consignment from mill warehouse • Leg 2: Direct delivery to customer or boutique with OTP and COD reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-edge text-xs">
              <span className="text-ink-muted block text-[10px] uppercase font-mono">
                Agent On Duty
              </span>
              <span className="font-bold text-ink">
                {user?.full_name || "Transporter"}
              </span>
            </div>
          </div>
        </div>

        {successToast && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl luxury-card border border-gold-500/35 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span className="text-gold-400 font-semibold">
                Active Run Tasks
              </span>
              <Package className="w-4 h-4 text-gold-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-ink">
              {activeTasks.length}
            </p>
            <p className="text-[11px] text-ink-muted">
              Pickups and deliveries in progress
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span>COD Cash Collected Today</span>
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {formatINR(totalCodCollected)}
            </p>
            <p className="text-[11px] text-ink-muted">
              Pending remit: {formatINR(pendingCod)}
            </p>
          </div>

          <div className="p-6 rounded-3xl luxury-card space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span>Completed Runs</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-ink">
              {completedTasks.length}
            </p>
            <p className="text-[11px] text-ink-muted">OTP verified handovers</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-edge pb-2 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "active"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Active Tasks ({activeTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === "completed"
                ? "bg-gold-500 text-black shadow-gold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Completed History ({completedTasks.length})
          </button>
        </div>

        <div className="space-y-4">
          {(activeTab === "active" ? activeTasks : completedTasks).length ===
          0 ? (
            <div className="p-12 rounded-3xl luxury-card text-center text-xs text-ink-muted">
              No {activeTab} deliveries assigned right now.
            </div>
          ) : (
            (activeTab === "active" ? activeTasks : completedTasks).map((del) => {
              const isPickup = del.leg === "pickup";
              const sub = del.sub_order;
              const shop = sub?.shop;
              const addr = sub?.parent_order?.address_snapshot;

              return (
                <div
                  key={del.id}
                  className="p-6 rounded-3xl luxury-card hover:border-gold-500/40 transition space-y-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 ${
                            isPickup
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {isPickup ? (
                            <Store className="w-3.5 h-3.5" />
                          ) : (
                            <User className="w-3.5 h-3.5" />
                          )}
                          Leg{" "}
                          {isPickup ? "1: Mill Pickup" : "2: Buyer Delivery"}
                        </span>

                        <span className="font-mono text-xs text-ink-secondary">
                          Sub-Order:{" "}
                          <strong className="text-ink">
                            {sub?.sub_order_no || del.sub_order_id}
                          </strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            del.status === "delivered" ||
                            del.status === "picked_up"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-surface-subtle text-ink-secondary"
                          }`}
                        >
                          {del.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-xs text-ink-secondary">
                        {isPickup
                          ? `From: ${shop?.shop_name || "Seller Mill"}, ${
                              shop?.city || ""
                            }`
                          : `To: ${addr?.name || "Consignee"}, ${
                              addr?.city || ""
                            }`}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {del.cod_amount > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-ink-muted">
                            Cash on Delivery
                          </p>
                          <p className="text-base font-bold font-mono text-gold-400">
                            {formatINR(del.cod_amount)}
                          </p>
                        </div>
                      )}

                      {del.status !== "delivered" &&
                        del.status !== "picked_up" &&
                        del.status !== "failed" && (
                          <button
                            type="button"
                            onClick={() => handleOpenAction(del)}
                            className="px-5 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2"
                          >
                            <KeyRound className="w-4 h-4" />
                            {isPickup
                              ? "Verify Mill Pickup"
                              : "Complete Delivery"}
                          </button>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-surface-subtle space-y-1">
                      <span className="text-[10px] font-mono uppercase text-ink-muted">
                        Contact / Address
                      </span>
                      <p className="font-semibold text-ink">
                        {isPickup
                          ? shop?.shop_name || "Seller Mill"
                          : `${addr?.name || "Buyer"} (${
                              addr?.phone || "N/A"
                            })`}
                      </p>
                      <p className="text-ink-secondary text-[11px]">
                        {isPickup
                          ? `${shop?.address_line1 || ""}, ${
                              shop?.city || ""
                            }, ${shop?.state || ""}`
                          : `${addr?.line1 || ""}, ${addr?.city || ""}, ${
                              addr?.state || ""
                            } ${addr?.pincode || ""}`}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {!isPickup && addr?.phone ? (
                          <a
                            href={`tel:${addr.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-edge hover:border-gold-500 text-[11px] font-semibold text-gold-400"
                          >
                            <Phone className="w-3 h-3" /> Call Consignee
                          </a>
                        ) : null}
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            isPickup
                              ? `${shop?.address_line1 || ""} ${shop?.city || ""} ${shop?.pincode || ""}`
                              : `${addr?.line1 || ""} ${addr?.city || ""} ${addr?.pincode || ""}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-edge hover:border-gold-500 text-[11px] font-semibold text-ink"
                        >
                          <Navigation className="w-3 h-3 text-gold-400" /> Navigate
                        </a>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-subtle space-y-1">
                      <span className="text-[10px] font-mono uppercase text-ink-muted">
                        Security Verification
                      </span>
                      <p className="text-ink-secondary">
                        Ask {isPickup ? "Mill Dispatch Manager" : "Consignee"}{" "}
                        for the 4-digit handover OTP.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedDelivery && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="luxury-card-elevated border border-gold-500/40 w-full max-w-lg rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-edge pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-gold-400" />
                    {selectedDelivery.leg === "pickup"
                      ? "Verify Mill Consignment Pickup"
                      : "Complete Buyer Delivery"}
                  </h3>
                  <p className="text-[11px] text-ink-secondary">
                    Sub-Order: {selectedDelivery.sub_order?.sub_order_no}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="p-1.5 text-ink-muted hover:text-ink"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmTask} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-ink-secondary">
                    Enter 4-Digit Handover OTP
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required={!failureReason && !rescheduleDate}
                    value={enteredOtp}
                    onChange={(e) => {
                      setEnteredOtp(e.target.value);
                      setOtpError(false);
                    }}
                    placeholder="••••"
                    className={`w-full px-4 py-3 rounded-xl bg-surface-input border text-ink font-mono text-center tracking-[0.5em] text-lg focus:border-gold-500 outline-none ${
                      otpError ? "border-red-500" : "border-edge"
                    }`}
                  />
                  {otpError && (
                    <p className="text-red-600 dark:text-red-400 text-[10px]">
                      Incorrect OTP code. Please verify with consignee/mill.
                    </p>
                  )}
                </div>

                {selectedDelivery.cod_amount > 0 &&
                  selectedDelivery.leg === "delivery" && (
                    <div className="p-4 rounded-xl bg-surface-subtle border border-gold-500/30 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-ink">
                          Cash on Delivery:{" "}
                          {formatINR(selectedDelivery.cod_amount)}
                        </p>
                        <p className="text-[10px] text-ink-secondary">
                          Collect physical currency before handover
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gold-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={codCollected}
                          onChange={(e) => setCodCollected(e.target.checked)}
                          className="w-4 h-4 accent-gold-500 rounded"
                        />
                        Cash Collected
                      </label>
                    </div>
                  )}

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-dashed border-edge flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-4 h-4 text-gold-400" />
                    <span className="text-ink-secondary">
                      {proofFile
                        ? proofFile.name
                        : "Upload Delivery Photo Proof"}
                    </span>
                  </div>
                  <label className="px-3 py-1 rounded-lg text-xs font-semibold bg-surface border border-edge text-ink hover:border-gold-500 cursor-pointer">
                    Choose File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setProofFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-ink-secondary text-[11px]">
                    Optional Failure Reason (leave blank if delivered)
                  </label>
                  <input
                    type="text"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="e.g. Consignee unreachable"
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-ink-secondary text-[11px] flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-gold-400" />
                    Or Reschedule Next Attempt
                  </label>
                  <input
                    type="datetime-local"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDelivery(null)}
                    className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary hover:text-ink font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl btn-gold-luxury uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Confirm Handover
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
