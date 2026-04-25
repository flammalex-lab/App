"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/utils/format";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

/**
 * Ambient-info top bar: delivery + cutoff. Designed to feel like ambient
 * status (low visual weight) rather than chrome (high weight) — single
 * line, hairline border, color-shifted by urgency:
 *
 *   - >12h to cutoff: neutral wash (brand-blue tint)
 *   - 1–12h:          warning (accent-gold)
 *   - <1h or past:    error (red)
 *
 * Tap reveals a sheet with full delivery details so the bar itself
 * stays tight.
 */
export function CutoffClock({ next }: { next: SerializedNextDelivery | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!next) {
    return (
      <div className="bg-bg-secondary text-[11px] text-ink-secondary text-center py-1 px-3 border-b border-black/[0.06]">
        Delivery zone not set — ask your rep to assign one.
      </div>
    );
  }

  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const urgent = !past && ms < 60 * 60 * 1000; // < 1h
  const warn = !past && !urgent && ms < 12 * 60 * 60 * 1000; // 1–12h

  const tone =
    past || urgent
      ? "bg-feedback-error/8 text-feedback-error border-feedback-error/15"
      : warn
      ? "bg-accent-gold/12 text-[#7a5a12] border-accent-gold/25"
      : "bg-brand-blue-tint text-brand-blue-dark border-brand-blue/10";

  const deliveryDate = new Date(next.deliveryDate);
  const dayLabel = `${next.deliveryDayName.slice(0, 3)} ${deliveryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const cutoffLabel = past ? "cutoff passed" : `${countdown(ms)} to cutoff`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Delivery details"
        className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 border-b text-[12px] leading-tight transition-colors duration-150 hover:brightness-95 active:brightness-90 ${tone}`}
      >
        <CalendarIcon />
        <span className="font-semibold tracking-tight">Delivery {dayLabel}</span>
        <span aria-hidden className="opacity-40">·</span>
        <span className="tabular">{cutoffLabel}</span>
        <span aria-hidden className="ml-1 opacity-60">›</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Delivery & cutoff">
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${tone}`}>
              <CalendarIcon />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-ink-secondary font-medium">
                Next delivery
              </div>
              <div className="display text-xl tracking-tight">
                {next.deliveryDayName},{" "}
                {deliveryDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span
              className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${
                past || urgent
                  ? "bg-feedback-error/10 text-feedback-error"
                  : warn
                  ? "bg-accent-gold/15 text-[#7a5a12]"
                  : "bg-brand-blue-tint text-brand-blue-dark"
              }`}
            >
              <ClockIcon />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-ink-secondary font-medium">
                Cutoff
              </div>
              <div className="display text-xl tracking-tight">
                {past
                  ? "Passed"
                  : `${countdown(ms)} remaining`}
              </div>
              <div className="text-[12px] text-ink-tertiary mt-0.5">
                Submit by{" "}
                {new Date(next.cutoffAt).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          <p className="text-[12px] text-ink-secondary leading-relaxed border-t border-black/[0.06] pt-3">
            Orders placed after the cutoff are queued for the next available
            delivery date. Need a special arrangement?{" "}
            <a href="/chat" className="text-brand-blue underline">
              Message your rep
            </a>
            .
          </p>
        </div>
      </BottomSheet>
    </>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
