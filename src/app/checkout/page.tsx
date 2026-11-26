"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatINR } from "@/lib/utils";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import {
  ShieldCheck,
  AlertCircle,
  Truck,
  Store,
  Clock,
  CreditCard,
  QrCode,
  Tag,
  ArrowRight,
  ShoppingBag,
  Upload,
  CheckCircle2,
  Wallet,
} from "lucide-react";

type CheckoutPaymentMethod =
  | "razorpay"
  | "cod"
  | "bank_transfer"
  | "credit_terms";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
    };
  }
}

async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const existing = document.getElementById("razorpay-checkout-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const { user, role } = useAuth();
  const {
    items,
    getShopGroups,
    subtotal,
    taxTotal,
    shipping,
    discountAmount,
    total,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    clearCart,
  } = useCart();
  const router = useRouter();

  const isB2B = role === "b2b";

  const [bankInfo, setBankInfo] = useState<{
    upi_id?: string;
    account_name?: string;
    account_no?: string;
    ifsc?: string;
    bank_name?: string;
  } | null>(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    buyerGstin: "",
    notes: "",
  });

  const [pincodeStatus, setPincodeStatus] = useState<{
    checked: boolean;
    serviceable?: boolean;
    message?: string;
  }>({ checked: false });

  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>("razorpay");
  const [upiReference, setUpiReference] = useState("");
  const [paymentProofRef, setPaymentProofRef] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.full_name || "",
        phone: prev.phone || user.phone || "",
        buyerGstin: prev.buyerGstin || user.gst_no || "",
      }));
    }
  }, [user]);

  // Load dynamic bank transfer instructions & wallet balance from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();

    supabase
      .from("settings")
      .select("value")
      .eq("key", "bank_transfer_info")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setBankInfo(data.value as any);
        }
      });

    if (user?.id) {
      supabase
        .from("wallet_ledger")
        .select("balance_after")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.balance_after) {
            setWalletBalance(Number(data.balance_after));
          }
        });
    }
  }, [user?.id]);

  // Check pincode serviceability dynamically
  useEffect(() => {
    const cleanPin = formData.pincode.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setPincodeStatus({ checked: false });
      return;
    }

    let cancelled = false;
    fetch(`/api/service-areas?pincode=${encodeURIComponent(cleanPin)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPincodeStatus({
          checked: true,
          serviceable: Boolean(d.serviceable),
          message: d.serviceable
            ? `Serviceable (${d.city ? `${d.city}, ` : ""}Est. ${d.estimatedDays || 4} days${d.codAvailable ? " • COD Available" : " • Prepaid Only"})`
            : d.message || "Delivery currently unavailable for this pincode.",
        });
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [formData.pincode]);

  const shopGroups = getShopGroups();

  if (items.length === 0) {
    return (
      <div className="bg-canvas min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full luxury-card rounded-3xl p-8 text-center space-y-4">
          <ShoppingBag className="w-10 h-10 text-gold-400 mx-auto" />
          <h1 className="text-xl font-heading font-bold text-ink">
            Your Checkout Bag is Empty
          </h1>
          <p className="text-xs text-ink-secondary">
            Add fabrics, sarees, or B2B textile packs before checking out.
          </p>
          <Link
            href="/catalog"
            className="btn-gold-luxury px-6 py-3 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
          >
            Browse Catalog
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append("bucket", "payment-proofs");
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Proof upload failed.");
      setPaymentProofRef(data.privateRef || data.path);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to upload payment proof.");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;
    const res = await applyCoupon(couponCodeInput);
    setCouponMsg({ success: res.success, text: res.message });
    if (res.success) setCouponCodeInput("");
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !formData.fullName ||
      !formData.phone ||
      !formData.line1 ||
      !formData.city ||
      !formData.state ||
      !/^\d{6}$/.test(formData.pincode.trim())
    ) {
      setErrorMsg(
        "Please fill in all mandatory delivery fields including a valid 6-digit pincode."
      );
      return;
    }

    if (pincodeStatus.checked && pincodeStatus.serviceable === false) {
      setErrorMsg(pincodeStatus.message || "Delivery is unavailable for this pincode.");
      return;
    }

    if (paymentMethod === "bank_transfer" && !upiReference && !paymentProofRef) {
      setErrorMsg(
        "Please provide your UPI/NEFT UTR reference or upload a payment receipt."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            product_id: it.product.id,
            variant_id: it.variant.id,
            quantity: it.quantity,
          })),
          address_snapshot: {
            name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            line1: formData.line1.trim(),
            line2: formData.line2.trim() || null,
            city: formData.city.trim(),
            state: formData.state.trim(),
            pincode: formData.pincode.trim(),
            buyer_gstin: formData.buyerGstin.trim().toUpperCase() || null,
          },
          payment_method: paymentMethod,
          payment_proof_url: paymentProofRef,
          coupon_code: appliedCoupon?.code || null,
          use_wallet: useWallet,
          notes: upiReference
            ? `UTR Reference: ${upiReference}${
                formData.notes ? ` | ${formData.notes}` : ""
              }`
            : formData.notes || null,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.order) {
        throw new Error(data.error || "Failed to place order.");
      }

      if (data.razorpayRequired) {
        const createRes = await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.order.id }),
        });
        const rzpData = await createRes.json();
        if (!createRes.ok) {
          clearCart();
          router.push(`/orders/${data.order.order_no}?payment=pending`);
          return;
        }

        const scriptReady = await loadRazorpayCheckoutScript();
        if (!scriptReady || !window.Razorpay) {
          throw new Error(
            "Unable to load Razorpay Checkout script. You can complete payment from My Orders."
          );
        }

        const rzp = new window.Razorpay({
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: "Trio Dealers",
          description: `Order ${data.order.order_no}`,
          order_id: rzpData.razorpayOrderId,
          prefill: {
            name: formData.fullName,
            contact: formData.phone,
            email: user?.email || undefined,
          },
          theme: { color: "#D4AF37" },
          handler: async (rzpResponse: any) => {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.order.id,
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              clearCart();
              router.push(`/order-success/${data.order.order_no}`);
            } else {
              const vErr = await verifyRes.json().catch(() => ({}));
              setErrorMsg(
                vErr.error ||
                  "Payment signature verification failed. Check My Orders."
              );
              setIsSubmitting(false);
            }
          },
          modal: {
            ondismiss: () => {
              setErrorMsg(
                `Order ${data.order.order_no} was created with pending payment. Complete payment from My Orders.`
              );
              clearCart();
              setIsSubmitting(false);
            },
          },
        });

        rzp.open();
        return;
      }

      clearCart();
      router.push(`/order-success/${data.order.order_no}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit order. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/12 text-gold-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Server-Verified Atomic Checkout
          </div>
          <h1 className="text-2xl sm:text-3xl font-royal font-bold text-ink tracking-wide">
            Direct Mill Consignment Checkout
          </h1>
          <p className="text-xs text-ink-secondary">
            Items from {shopGroups.length} distinct shops will be split into tracked parcels with dedicated GST invoices.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-5 rounded-3xl luxury-card space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Multi-Vendor Shipment Breakdown (
                  {shopGroups.length})
                </span>
                <div className="space-y-2">
                  {shopGroups.map((g, i) => (
                    <div
                      key={g.shopId}
                      className="p-3.5 rounded-2xl bg-surface-subtle border border-edge flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-ink flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-gold-400" /> Parcel{" "}
                          {i + 1}: {g.shopName}
                        </span>
                        <span className="text-[11px] text-ink-secondary">
                          {g.items
                            .map((it) => `${it.quantity}x ${it.product.name}`)
                            .join(", ")}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-ink">
                        {formatINR(g.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 1: Delivery Address */}
              <div className="p-6 rounded-3xl luxury-card space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-edge pb-3">
                  1. Delivery &amp; Consignment Address
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-ink-secondary mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-secondary mb-1.5">
                      Mobile Phone (WhatsApp) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink text-xs focus:border-gold-500 outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs space-y-1.5">
                  <label className="block font-semibold text-ink-secondary">
                    Address / Shop Landmark *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.line1}
                    onChange={(e) =>
                      setFormData({ ...formData, line1: e.target.value })
                    }
                    placeholder="Plot / Street / Market Chamber"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs focus:border-gold-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-ink-secondary mb-1.5">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-ink-secondary mb-1.5">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-ink-secondary mb-1.5">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={formData.pincode}
                      onChange={(e) =>
                        setFormData({ ...formData, pincode: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-surface-input border border-edge text-ink text-xs font-mono"
                    />
                  </div>
                </div>

                {pincodeStatus.checked && (
                  <p
                    className={`text-[11px] flex items-center gap-1.5 ${
                      pincodeStatus.serviceable
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {pincodeStatus.serviceable ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    {pincodeStatus.message}
                  </p>
                )}

                <div className="text-xs space-y-1.5">
                  <label className="block font-semibold text-ink-secondary">
                    Buyer GSTIN{" "}
                    {isB2B && (
                      <span className="text-gold-400">
                        * (For Input Tax Credit)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.buyerGstin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        buyerGstin: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. 27AABCP8921R1Z3"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted text-xs font-mono uppercase focus:border-gold-500 outline-none"
                  />
                </div>
              </div>

              {/* Section 2: Payment Method */}
              <div className="p-6 rounded-3xl luxury-card space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-edge pb-3">
                  2. Select Settlement Method
                </h2>

                <div className="space-y-3">
                  {isB2B && (
                    <label
                      className={`block p-4 rounded-2xl border cursor-pointer transition ${
                        paymentMethod === "credit_terms"
                          ? "border-gold-500 bg-gold-500/10 shadow-gold"
                          : "border-edge hover:border-edge-strong bg-surface-subtle"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="credit_terms"
                            checked={paymentMethod === "credit_terms"}
                            onChange={() => setPaymentMethod("credit_terms")}
                            className="accent-gold-500"
                          />
                          <div>
                            <p className="font-bold text-ink text-xs flex items-center gap-2">
                              <span>Trade Credit Line</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                Verified B2B
                              </span>
                            </p>
                            <p className="text-[11px] text-ink-secondary">
                              Available Credit:{" "}
                              <strong className="text-gold-400 font-mono">
                                {formatINR(user?.credit_balance || 0)}
                              </strong>
                            </p>
                          </div>
                        </div>
                        <Clock className="w-5 h-5 text-gold-400" />
                      </div>
                    </label>
                  )}

                  <label
                    className={`block p-4 rounded-2xl border cursor-pointer transition ${
                      paymentMethod === "razorpay"
                        ? "border-gold-500 bg-gold-500/10 shadow-gold"
                        : "border-edge hover:border-edge-strong bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="razorpay"
                          checked={paymentMethod === "razorpay"}
                          onChange={() => setPaymentMethod("razorpay")}
                          className="accent-gold-500"
                        />
                        <div>
                          <p className="font-bold text-ink text-xs">
                            Razorpay (UPI, Cards &amp; Netbanking)
                          </p>
                          <p className="text-[11px] text-ink-secondary">
                            Verified server-signed online payment.
                          </p>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 text-gold-400" />
                    </div>
                  </label>

                  <label
                    className={`block p-4 rounded-2xl border cursor-pointer transition ${
                      paymentMethod === "cod"
                        ? "border-gold-500 bg-gold-500/10 shadow-gold"
                        : "border-edge hover:border-edge-strong bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === "cod"}
                          onChange={() => setPaymentMethod("cod")}
                          className="accent-gold-500"
                        />
                        <div>
                          <p className="font-bold text-ink text-xs">
                            Cash on Delivery (COD)
                          </p>
                          <p className="text-[11px] text-ink-secondary">
                            Pay courier upon verified parcel handover.
                          </p>
                        </div>
                      </div>
                      <Truck className="w-5 h-5 text-ink-secondary" />
                    </div>
                  </label>

                  <label
                    className={`block p-4 rounded-2xl border cursor-pointer transition ${
                      paymentMethod === "bank_transfer"
                        ? "border-gold-500 bg-gold-500/10 shadow-gold"
                        : "border-edge hover:border-edge-strong bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank_transfer"
                          checked={paymentMethod === "bank_transfer"}
                          onChange={() => setPaymentMethod("bank_transfer")}
                          className="accent-gold-500"
                        />
                        <div>
                          <p className="font-bold text-ink text-xs">
                            Direct Bank NEFT / RTGS / UPI Transfer
                          </p>
                          <p className="text-[11px] text-ink-secondary">
                            Transfer and upload private payment proof receipt.
                          </p>
                        </div>
                      </div>
                      <QrCode className="w-5 h-5 text-gold-400" />
                    </div>
                  </label>
                </div>

                {paymentMethod === "bank_transfer" && (
                  <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-4 text-xs">
                    {bankInfo ? (
                      <div className="p-3 rounded-xl bg-surface border border-edge space-y-1 font-mono text-[11px]">
                        {bankInfo.upi_id && (
                          <p className="text-ink-secondary">
                            UPI ID: <strong className="text-gold-400">{bankInfo.upi_id}</strong>
                          </p>
                        )}
                        {bankInfo.account_name && (
                          <p className="text-ink-secondary">A/C Name: {bankInfo.account_name}</p>
                        )}
                        {bankInfo.account_no && (
                          <p className="text-ink-secondary">
                            {bankInfo.bank_name ? `${bankInfo.bank_name} • ` : ""}A/C: {bankInfo.account_no}
                          </p>
                        )}
                        {bankInfo.ifsc && (
                          <p className="text-ink-secondary">IFSC: {bankInfo.ifsc}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-muted">
                        Bank settlement details are managed in Admin -&gt; CMS &amp; Settings.
                      </p>
                    )}

                    <div>
                      <label className="block text-ink-secondary font-semibold mb-1">
                        Bank Transaction ID / UTR Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR893471928"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-surface-input border border-edge text-ink font-mono text-xs outline-none focus:border-gold-500"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-secondary font-semibold mb-1">
                        Upload Transfer Receipt (Private Encrypted Bucket)
                      </label>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-edge bg-surface hover:border-gold-500/50 cursor-pointer text-xs font-semibold text-ink">
                        <Upload className="w-3.5 h-3.5 text-gold-400" />
                        <span>
                          {uploadingProof
                            ? "Uploading..."
                            : paymentProofRef
                            ? "Receipt Uploaded ✓"
                            : "Choose Receipt Image or PDF"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={handleProofUpload}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
              <div className="p-6 rounded-3xl luxury-card-elevated border border-gold-500/35 space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-edge pb-3 flex items-center justify-between">
                  <span>Order Summary</span>
                  <span className="text-gold-400 font-mono text-xs">
                    {items.length} items
                  </span>
                </h2>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 truncate">
                        <p className="font-semibold text-ink truncate">
                          {it.product.name}
                        </p>
                        <p className="text-[11px] text-ink-secondary">
                          {it.variant.color} • {it.quantity} pcs @{" "}
                          {formatINR(it.unitPrice)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-ink shrink-0">
                        {formatINR(it.unitPrice * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {walletBalance > 0 && (
                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-edge cursor-pointer text-xs">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <Wallet className="w-4 h-4 text-gold-400" />
                      Use Store Wallet ({formatINR(walletBalance)})
                    </span>
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      className="accent-gold-500 w-4 h-4"
                    />
                  </label>
                )}

                <div className="pt-3 border-t border-edge space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gold-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Coupon Code
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponCodeInput}
                      onChange={(e) =>
                        setCouponCodeInput(e.target.value.toUpperCase())
                      }
                      className="flex-1 px-3 py-1.5 rounded-xl bg-surface-input border border-edge text-ink placeholder:text-ink-muted font-mono text-xs uppercase focus:border-gold-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 py-1.5 rounded-xl bg-surface-subtle border border-edge hover:bg-gold-500 hover:text-black text-ink font-bold text-xs transition"
                    >
                      Apply
                    </button>
                  </div>

                  {couponMsg && (
                    <p
                      className={`text-[11px] ${
                        couponMsg.success
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {couponMsg.text}
                    </p>
                  )}

                  {appliedCoupon && (
                    <div className="p-2.5 rounded-xl bg-gold-500/12 border border-gold-500/35 flex items-center justify-between text-xs text-gold-400">
                      <span>
                        Coupon: <strong>{appliedCoupon.code}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-red-400 hover:underline text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-edge space-y-2 text-xs">
                  <div className="flex justify-between text-ink-secondary">
                    <span>Items Subtotal</span>
                    <span className="font-mono font-bold text-ink">
                      {formatINR(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-secondary">
                    <span>GST (CGST + SGST / IGST)</span>
                    <span className="font-mono font-bold text-ink">
                      {formatINR(taxTotal)}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-secondary">
                    <span>Freight</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {shipping === 0 ? "FREE" : formatINR(shipping)}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-gold-400 font-semibold">
                      <span>Coupon Discount</span>
                      <span className="font-mono">
                        - {formatINR(discountAmount)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-edge flex justify-between items-baseline">
                    <span className="text-sm font-bold text-ink">
                      Grand Total
                    </span>
                    <span className="text-2xl font-royal font-bold text-gold-400 font-mono">
                      {formatINR(total)}
                    </span>
                  </div>
                </div>

                <TurnstileWidget onToken={setTurnstileToken} />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl btn-gold-luxury text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Processing Atomic Order..."
                    : `Place Order • ${formatINR(total)}`}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
