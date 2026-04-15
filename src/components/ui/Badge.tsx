import { cn } from "@/lib/utils/cn";
import type { OrderStatus } from "@/lib/supabase/types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    draft: "badge-gray",
    pending: "badge-gold",
    confirmed: "badge-sage",
    processing: "badge-sage",
    ready: "badge-green",
    shipped: "badge-green",
    delivered: "badge-green",
    cancelled: "badge-red",
  };
  return <span className={cn(map[status])}>{status}</span>;
}

export function Chip({ tone = "gray", children }: { tone?: "gray" | "green" | "gold" | "rust" | "red" | "sage"; children: React.ReactNode }) {
  const map = {
    gray: "badge-gray",
    green: "badge-green",
    gold: "badge-gold",
    rust: "badge-rust",
    red: "badge-red",
    sage: "badge-sage",
  } as const;
  return <span className={map[tone]}>{children}</span>;
}
