"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/utils/format";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

/**
 * Compact three-fact bar shown at the top of every B2B buyer page:
 * Delivery date · Cutoff countdown · Order minimum.
 */
export function CutoffClock({
  next,
  minimum,
}: {
  next: SerializedNextDelivery | null;
  minimum: number | null;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!next) {
    return (
      <div className="rounded-md bg-bg-secondary px-3 py-2 text-sm text-ink-secondary text-center">
        Delivery zone not set — ask your rep to assign one.
      </div>
    );
  }

  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const deliveryDate = new Date(next.deliveryDate);
  const deliveryStr = `${next.deliveryDayName.slice(0, 3)} ${deliveryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div
      className={`rounded-xl border px-3 py-2 grid grid-cols-3 text-center text-xs ${
        past
          ? "bg-feedback-error/10 border-feedback-error/20 text-feedback-error"
          : "bg-brand-blue-tint border-brand-blue/10"
      }`}
    >
      <div>
        <div className="text-[10px] text-ink-secondary uppercase tracking-wide">Delivery</div>
        <div className={`font-semibold mt-0.5 ${past ? "" : "text-brand-blue-dark"}`}>
          {deliveryStr}
        </div>
      </div>
      <div className="border-x border-brand-blue/10">
        <div className="text-[10px] text-ink-secondary uppercase tracking-wide">Cutoff</div>
        <div className={`mono font-semibold mt-0.5 ${past ? "" : "text-brand-blue-dark"}`}>
          {past ? "passed" : countdown(ms)}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-ink-secondary uppercase tracking-wide">Minimum</div>
        <div className={`mono font-semibold mt-0.5 ${past ? "" : "text-brand-blue-dark"}`}>
          {minimum ? `$${minimum}` : "None"}
        </div>
      </div>
    </div>
  );
}
