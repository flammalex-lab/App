"use client";

import { useCart } from "@/lib/cart/store";

export function CartBadge() {
  const count = useCart((s) => s.lines.length);
  if (!count) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-xs">
      {count}
    </span>
  );
}
