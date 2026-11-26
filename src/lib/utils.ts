import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function getOrderStatusBadge(status: string) {
  switch (status) {
    case "Placed":
      return { label: "Placed", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" };
    case "Confirmed":
      return { label: "Confirmed", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" };
    case "Packed":
      return { label: "Packed", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" };
    case "Assigned to Transporter":
      return { label: "Assigned", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" };
    case "Out for Delivery":
      return { label: "Out for Delivery", color: "bg-amber-400/20 text-gold-400 border-gold-500/40" };
    case "Delivered":
      return { label: "Delivered", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    case "Cancelled":
      return { label: "Cancelled", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" };
    case "Returned":
      return { label: "Returned", color: "bg-surface-subtle text-ink-muted border-edge-strong" };
    default:
      return { label: status, color: "bg-surface-subtle text-ink-secondary border-edge-strong" };
  }
}

