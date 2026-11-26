"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Truck, MessageCircle } from "lucide-react";

export default function OrderSuccessPage() {
  const params = useParams();
  const orderNo = params?.orderNo as string;
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210";

  return (
    <div className="bg-canvas min-h-[75vh] py-16 sm:py-20 px-4">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="relative mx-auto w-24 h-24 rounded-full bg-gold-500/12 border-2 border-gold-500/50 flex items-center justify-center shadow-gold-lg">
          <CheckCircle2 className="w-12 h-12 text-gold-400" />
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-gold-400">
            Order Successfully Placed
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-black text-ink">
            Thank You for Shopping with Trio Dealers
          </h1>
          <p className="text-ink-secondary text-sm max-w-lg mx-auto">
            We have registered your order. Our warehouse team is preparing your fabrics for packing and transporter assignment.
          </p>
        </div>

        <div className="p-6 rounded-3xl luxury-card-elevated border border-gold-500/35 max-w-md mx-auto space-y-2">
          <span className="text-xs text-ink-muted uppercase tracking-wider">
            Your Order Reference Number
          </span>
          <div className="text-2xl font-mono font-bold text-gold-400">
            {orderNo}
          </div>
          <p className="text-[11px] text-ink-secondary">
            Please keep this number for courier tracking and WhatsApp support.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href={`/orders/${orderNo}`}
            className="w-full sm:w-auto btn-gold-luxury px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Truck className="w-4 h-4" />
            Track Order Timeline
          </Link>

          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
              `Hello Trio Dealers! I just placed order ${orderNo}. Please confirm shipment status.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Order Updates on WhatsApp
          </a>
        </div>

        <div className="pt-4">
          <Link
            href="/catalog"
            className="text-xs text-ink-muted hover:text-gold-400 transition font-medium"
          >
            ← Continue Browsing Fabrics
          </Link>
        </div>
      </div>
    </div>
  );
}
