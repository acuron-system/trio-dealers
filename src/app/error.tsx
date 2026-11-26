"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[65vh] bg-canvas flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full luxury-card-elevated rounded-3xl p-8 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-bold text-ink">
          Something Went Wrong
        </h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          We encountered a temporary problem rendering this view. No sensitive data was exposed.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-edge text-xs font-semibold text-ink hover:border-gold-500/50"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

