"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/utils/format";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

/**
 * Thin persistent top strip: delivery + cutoff on a single line. Always
 * present, minimal footprint — sits above the main nav.
 */
export function CutoffClock({ next }: { next: SerializedNextDelivery | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!next) {
    return (
      <div className="bg-bg-secondary text-[10px] text-ink-secondary text-center py-0.5 px-3 border-b border-black/5">
        Delivery zone not set — ask your rep to assign one.
      </div>
    );
  }

  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const deliveryDate = new Date(next.deliveryDate);
  const deliveryStr = `${next.deliveryDayName}, ${deliveryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div
      className={`text-[10px] leading-none py-0.5 px-3 flex items-center justify-center gap-2 border-b ${
        past
          ? "bg-feedback-error/10 text-feedback-error border-feedback-error/20"
          : "bg-brand-blue-tint text-brand-blue-dark border-brand-blue/10"
      }`}
    >
      <span className="font-semibold">{deliveryStr}</span>
      <span className="opacity-50">·</span>
      <span className="tabular">
        {past ? "cutoff passed" : `${countdown(ms)} to cutoff`}
      </span>
    </div>
  );
}
