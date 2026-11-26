import React from "react";

export function ProductCardSkeleton() {
  return (
    <div className="luxury-card rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-[4/5] bg-surface-subtle" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-20 rounded bg-surface-subtle" />
        <div className="h-4 w-4/5 rounded bg-surface-subtle" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 w-24 rounded bg-surface-subtle" />
          <div className="h-8 w-8 rounded-lg bg-surface-subtle" />
        </div>
      </div>
    </div>
  );
}

export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 5, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <div className="divide-y divide-edge animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 rounded bg-surface-subtle" />
          ))}
        </div>
      ))}
    </div>
  );
}

