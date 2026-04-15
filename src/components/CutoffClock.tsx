"use client";

import { useEffect, useState } from "react";
import { countdown, dateLong } from "@/lib/utils/format";
import type { NextDelivery } from "@/lib/utils/cutoff";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

export function CutoffClock({ next }: { next: SerializedNextDelivery | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!next) {
    return (
      <div className="rounded-md bg-bg-secondary px-3 py-2 text-sm text-ink-secondary">
        Delivery zone not set — ask your rep to assign one.
      </div>
    );
  }

  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const deliveryDate = new Date(next.deliveryDate);

  return (
    <div
      className={`rounded-md px-3 py-2 text-sm flex items-center justify-between gap-3 ${
        past ? "bg-feedback-error/10 text-feedback-error" : "bg-brand-green/5 text-brand-green"
      }`}
    >
      <div>
        <span className="font-medium">Next delivery</span>{" "}
        {dateLong(deliveryDate)}
      </div>
      <div className="mono text-xs">
        {past ? "cutoff passed" : `cutoff in ${countdown(ms)}`}
      </div>
    </div>
  );
}
