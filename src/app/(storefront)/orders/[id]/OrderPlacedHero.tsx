"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/Brand";
import { dateLong, money } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayFromIso(iso: string | null): string {
  if (!iso) return DAY_NAMES_LONG[new Date().getDay()];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return DAY_NAMES_LONG[new Date().getDay()];
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return DAY_NAMES_LONG[d.getDay()];
}

export function OrderPlacedHero({
  orderNumber,
  deliveryDate,
  total,
  orderId,
}: {
  orderNumber: string;
  deliveryDate: string | null;
  total: number;
  orderId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  // Post-submit "save as standing" prompt — auto-dismisses after 10s if
  // ignored. Hidden once dismissed (manually or by save) for the lifetime
  // of this page render.
  const [standingPromptOpen, setStandingPromptOpen] = useState(true);
  const [standingSaving, setStandingSaving] = useState(false);
  useEffect(() => {
    if (!standingPromptOpen) return;
    const id = window.setTimeout(() => setStandingPromptOpen(false), 10_000);
    return () => window.clearTimeout(id);
  }, [standingPromptOpen]);

  async function saveAsStanding() {
    setStandingSaving(true);
    const res = await fetch("/api/standing/create-from-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        daysOfWeek: [dayFromIso(deliveryDate)],
        cadence: "weekly",
      }),
    });
    setStandingSaving(false);
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
    setStandingPromptOpen(false);
    router.push(`/standing/${id}`);
  }

  // "Animate on mount" — start with mounted=false so the CSS transitions
  // have an off-state to fade FROM, then flip to true after the first
  // paint. requestAnimationFrame defers the setState past the commit so
  // the React 19 set-state-in-effect lint doesn't flag a render cascade
  // (the canonical "you might not need an effect" pattern doesn't apply
  // — there's no derivable source for this; we're synchronizing with
  // the browser's compositor).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-blue text-white overflow-hidden">
      {/* Texture layer — blue gradient w/ subtle diagonal lines */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(135deg, #0F4A8A 0%, #1763B5 50%, #2A9B46 120%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 14px)",
        }}
      />

      {/* Content */}
      <div className="relative flex-1 flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-auto">
          <BrandLogo size={44} />
          <span className="display text-lg tracking-tight">Fingerlakes Farms</span>
        </div>

        <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* Celebratory check + confetti dots */}
          <div className="relative mb-6">
            <div className={`h-16 w-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center transition-transform duration-500 ${mounted ? "scale-100" : "scale-50"}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12 5 5L20 7" />
              </svg>
            </div>
            {/* Confetti — small offset dots that spring in */}
            <Confetti mounted={mounted} />
          </div>

          <p className="text-sm uppercase tracking-widest opacity-80 mb-3">
            Order {orderNumber}
          </p>
          <h1 className="display text-5xl sm:text-6xl md:text-7xl leading-[0.95] uppercase tracking-tighter">
            Sent.<br />We&apos;ve got it.
          </h1>
          <div className="mt-8 space-y-2">
            {deliveryDate ? (
              <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
                <span className="text-sm uppercase tracking-wide opacity-80">See you</span>
                <span className="font-semibold">{dateLong(deliveryDate)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
              <span className="text-sm uppercase tracking-wide opacity-80">Estimated total</span>
              <span className="tabular font-semibold">{money(total)}</span>
            </div>
          </div>
        </div>

        {standingPromptOpen ? (
          <div
            className={`mt-8 rounded-lg bg-white/12 backdrop-blur border border-white/20 px-4 py-3 transition-all duration-500 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            role="region"
            aria-label="Save as standing order"
          >
            <p className="text-sm font-medium leading-snug">
              Want to make this a regular order?
            </p>
            <p className="text-xs opacity-80 mt-0.5 leading-snug">
              We&apos;ll re-send it on a schedule and text you to confirm.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveAsStanding}
                disabled={standingSaving}
                className="flex-1 rounded-md bg-white text-brand-blue text-sm font-semibold py-2 hover:bg-bg-secondary transition disabled:opacity-60"
              >
                {standingSaving ? "Saving…" : "Save as standing"}
              </button>
              <button
                type="button"
                onClick={() => setStandingPromptOpen(false)}
                className="rounded-md border border-white/30 text-white/90 text-sm py-2 px-3 hover:bg-white/10 transition"
              >
                No thanks
              </button>
            </div>
          </div>
        ) : null}

        <div className={`mt-10 flex flex-col gap-2 transition-all duration-700 delay-150 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Link
            href={`/orders/${orderId}`}
            className="block w-full rounded-md bg-white text-brand-blue font-medium py-3 text-center hover:bg-bg-secondary transition"
          >
            View order details
          </Link>
          <Link
            href="/guide"
            className="block w-full py-3 text-center text-white/90 hover:text-white transition text-sm"
          >
            Back to guide
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Decorative confetti dots that spring outward from the checkmark on
 * mount. Pure CSS via inline transforms — no library, no GIF.
 */
function Confetti({ mounted }: { mounted: boolean }) {
  // Eight dots in a radial pattern around the check
  const dots = [
    { x: -42, y: -28, color: "bg-accent-gold", size: "h-1.5 w-1.5", delay: "100ms" },
    { x: 48, y: -22, color: "bg-white", size: "h-2 w-2", delay: "120ms" },
    { x: -52, y: 18, color: "bg-brand-green", size: "h-1.5 w-1.5", delay: "150ms" },
    { x: 58, y: 32, color: "bg-accent-gold", size: "h-2 w-2", delay: "170ms" },
    { x: -8, y: -52, color: "bg-white", size: "h-1.5 w-1.5", delay: "200ms" },
    { x: 14, y: 50, color: "bg-brand-green", size: "h-2 w-2", delay: "220ms" },
    { x: -64, y: -2, color: "bg-white", size: "h-1 w-1", delay: "260ms" },
    { x: 70, y: 6, color: "bg-accent-gold", size: "h-1 w-1", delay: "280ms" },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className={`absolute top-1/2 left-1/2 ${d.size} ${d.color} rounded-full transition-all duration-700 ease-out`}
          style={{
            transform: mounted
              ? `translate(${d.x}px, ${d.y}px)`
              : "translate(0, 0)",
            opacity: mounted ? 1 : 0,
            transitionDelay: d.delay,
          }}
        />
      ))}
    </>
  );
}
