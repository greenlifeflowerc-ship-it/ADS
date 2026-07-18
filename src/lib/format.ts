import { formatDistanceToNow } from "date-fns";

export function formatCurrency(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

/** 4-decimal cost, for small per-call amounts. */
export function formatUsd4(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(4)}`;
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
}

export function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
