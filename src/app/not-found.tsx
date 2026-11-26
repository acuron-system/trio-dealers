import Link from "next/link";
import { Search, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-canvas flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full luxury-card-elevated rounded-3xl p-8 text-center space-y-5">
        <span className="inline-flex px-3 py-1 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-widest">
          404 • Not Found
        </span>
        <h1 className="text-3xl font-heading font-extrabold text-ink">
          Page or Fabric Not Found
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          The page, shop storefront, or listing you requested could not be found or is no longer published.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="btn-gold-luxury px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
          <Link
            href="/catalog"
            className="px-5 py-2.5 rounded-xl border border-edge bg-surface hover:border-gold-500/50 text-xs font-semibold text-ink inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Browse Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}

