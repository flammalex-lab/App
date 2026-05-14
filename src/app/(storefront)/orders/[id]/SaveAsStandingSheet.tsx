"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface SaveAsStandingSheetProps {
  orderId: string;
  orderNumber: string;
  /** Pre-selected day of the week (full name, e.g. "Tuesday"). */
  defaultDay: string;
  /**
   * If a standing order has already been spun off this order, render the
   * button as a disabled "Already a standing order" state instead. We can't
   * see the existing one's id here, but the API's idempotency check will
   * surface it on click anyway.
   */
  existingStandingOrderId?: string | null;
}

/**
 * "Save as standing order" affordance for an existing order. Buyer-feedback
 * fix: the previous flow required navigating to /standing/new and rebuilding
 * the order from scratch. Now the buyer can convert any order — upcoming or
 * past — into a recurring template in two taps.
 *
 * Idempotency lives server-side; we surface it here as a toast that links
 * the buyer to the existing standing order rather than creating a duplicate.
 */
export function SaveAsStandingSheet({
  orderId,
  orderNumber,
  defaultDay,
  existingStandingOrderId,
}: SaveAsStandingSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string[]>([defaultDay]);
  const [cadence, setCadence] = useState<"weekly" | "biweekly">("weekly");
  const [saving, setSaving] = useState(false);

  function toggleDay(d: string) {
    setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));
  }

  async function save() {
    if (!days.length) {
      toast.push("Pick at least one day", "error");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/standing/create-from-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, daysOfWeek: days, cadence }),
    });
    setSaving(false);
    if (!res.ok) {
      const msg = await res.json().catch(() => ({ error: "Save failed" }));
      toast.push(msg.error ?? "Save failed", "error");
      return;
    }
    const { id, created } = (await res.json()) as { id: string; created: boolean };
    toast.push(
      created ? "Saved as a standing order" : "Already a standing order",
      "success",
    );
    setOpen(false);
    router.push(`/standing/${id}`);
  }

  if (existingStandingOrderId) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/standing/${existingStandingOrderId}`)}
        className="w-full btn-secondary py-3 text-base"
      >
        Already a standing order — view it
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full btn-secondary py-3 text-base"
      >
        Save as standing order
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Save as standing order"
      >
        <div className="px-5 py-5 space-y-4">
          <p className="text-[13px] text-ink-secondary leading-snug">
            Re-send order <span className="mono">{orderNumber}</span> on a
            schedule. We&apos;ll text you to confirm before each one submits.
          </p>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-secondary block mb-1.5 font-medium">
              Days of the week
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const selected = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={selected}
                    className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors duration-150 ${
                      selected
                        ? "bg-brand-green text-white border-brand-green"
                        : "bg-white border-black/10 hover:border-brand-blue/40"
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-secondary block mb-1.5 font-medium">
              Cadence
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCadence("weekly")}
                aria-pressed={cadence === "weekly"}
                className={`rounded-md border py-2 text-sm transition-colors duration-150 ${
                  cadence === "weekly"
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-white border-black/10 hover:border-brand-blue/40"
                }`}
              >
                Every week
              </button>
              <button
                type="button"
                onClick={() => setCadence("biweekly")}
                aria-pressed={cadence === "biweekly"}
                className={`rounded-md border py-2 text-sm transition-colors duration-150 ${
                  cadence === "biweekly"
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-white border-black/10 hover:border-brand-blue/40"
                }`}
              >
                Every other week
              </button>
            </div>
          </div>

          <Button
            onClick={save}
            loading={saving}
            loadingLabel="Saving…"
            disabled={!days.length}
            className="w-full"
          >
            Save standing order
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
