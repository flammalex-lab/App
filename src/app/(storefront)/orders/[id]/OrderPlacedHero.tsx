"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dateLong, money } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function dayFromIso(iso: string | null): string {
  if (!iso) return DAY_NAMES_LONG[new Date().getDay()];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return DAY_NAMES_LONG[new Date().getDay()];
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return DAY_NAMES_LONG[d.getDay()];
}

function placedAtShort(iso: string | null | undefined): string {
  if (!iso) return "just now";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface HeroLine {
  name: string;
  producer: string | null;
  qty: number;
  lineTotal: number;
}

/**
 * Order-placed hero — Brief 4 Option B "Receipt with landscape strip."
 *
 * Layout, top to bottom:
 *   1. Thin landscape photo strip (produce-1.jpg) with a caption pill
 *   2. Green check pill + order number + placed timestamp
 *   3. Big mixed-italic headline: "N lines locked in for [Day]. Thanks, X."
 *   4. Subhead about cutoff / when edits are accepted
 *   5. Ticket card — two top blocks (Delivery, Estimated total), a
 *      perforated divider, the 8 biggest line items, a footer total
 *   6. Standing-order conversion ask (PR #115) — green-tinted card
 *      with primary CTA; dismissible with "Not yet"
 *   7. View order details + Back to guide CTAs
 *
 * The standing-order ask MUST stay across any future Brief 4 ship — the
 * card is the post-submit conversion event and the only piece of the
 * old hero that was load-bearing.
 */
export function OrderPlacedHero({
  orderNumber,
  deliveryDate,
  total,
  orderId,
  placedAt,
  lineCount,
  producerCount,
  lines,
  remainingLines,
  remainingTotal,
}: {
  orderNumber: string;
  deliveryDate: string | null;
  total: number;
  orderId: string;
  placedAt: string | null | undefined;
  lineCount: number;
  producerCount: number;
  lines: HeroLine[];
  remainingLines: number;
  remainingTotal: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [standingPromptOpen, setStandingPromptOpen] = useState(true);
  const [standingSaving, setStandingSaving] = useState(false);

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

  // Fade-in on mount so the page settles in instead of slamming on.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const deliveryDay = deliveryDate ? dayFromIso(deliveryDate) : null;
  const headline = {
    dayPart: deliveryDay ? ` for ${deliveryDay}` : "",
  };

  return (
    <div
      className={`max-w-2xl mx-auto pb-20 transition-opacity duration-300 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* 1. Photo strip — 96px mobile, 128px desktop. Slightly taller than
          the brief's 88px to land the visual at app type sizes. */}
      <div className="relative h-24 md:h-32 overflow-hidden rounded-xl ring-1 ring-black/[0.06]">
        <Image
          src="/photos/produce-1.jpg"
          alt="Fresh produce loaded for delivery"
          fill
          sizes="(max-width: 768px) 100vw, 42rem"
          className="object-cover"
          style={{ objectPosition: "center 40%" }}
          priority
        />
      </div>

      {/* 2. Eyebrow row: green check pill + meta */}
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green text-white px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-[0_2px_8px_rgba(42,155,70,0.28)]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.5 6.3 5 8.5 9.5 3.8" />
          </svg>
          Order placed
        </span>
        <span className="text-[12px] text-ink-tertiary tabular">
          #{orderNumber} · placed {placedAtShort(placedAt)}
        </span>
      </div>

      {/* 3. Headline */}
      <h1 className="mt-3 display text-3xl md:text-4xl leading-[1.05] tracking-tight text-ink-primary">
        {lineCount} {lineCount === 1 ? "line" : "lines"} locked in
        {headline.dayPart}.
      </h1>

      {/* 5. Ticket */}
      <div className="mt-6 card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06]">
          <div className="px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-semibold">
              Delivery
            </div>
            <div className="mt-1 text-[15px] font-semibold tabular">
              {deliveryDate ? dateLong(deliveryDate) : "TBD"}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-semibold">
              Estimated total
            </div>
            <div className="mt-1 text-[15px] font-semibold tabular">
              {money(total)}
            </div>
          </div>
        </div>

        {/* Perforated divider — two small circles bite into either edge */}
        <div className="relative border-t border-dashed border-black/[0.14]">
          <span
            aria-hidden
            className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-bg-secondary ring-1 ring-black/[0.08]"
          />
          <span
            aria-hidden
            className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-bg-secondary ring-1 ring-black/[0.08]"
          />
        </div>

        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[11px] uppercase tracking-wider text-ink-secondary font-bold">
              Lines · {lineCount}
              {producerCount > 0 ? ` · from ${producerCount} ${producerCount === 1 ? "producer" : "producers"}` : ""}
            </h2>
            <Link
              href={`/orders/${orderId}`}
              className="text-[12px] text-brand-blue font-medium hover:text-brand-blue-dark"
            >
              View full order →
            </Link>
          </div>
          <ul className="divide-y divide-black/[0.04]">
            {lines.map((l, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="text-[13px] text-ink-primary min-w-0 truncate">
                  {l.name}
                  {l.producer ? (
                    <span className="text-ink-tertiary"> — {l.producer}</span>
                  ) : null}
                </span>
                <span className="text-[12px] text-ink-secondary tabular shrink-0">
                  ×{l.qty}
                </span>
                <span className="text-[13px] font-semibold tabular shrink-0 w-16 text-right">
                  {money(l.lineTotal)}
                </span>
              </li>
            ))}
            {remainingLines > 0 ? (
              <li className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-[13px] text-ink-tertiary italic">
                  + {remainingLines} more {remainingLines === 1 ? "line" : "lines"}
                </span>
                <span className="shrink-0" />
                <span className="text-[13px] font-semibold tabular shrink-0 w-16 text-right">
                  {money(remainingTotal)}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="border-t border-black/[0.06] px-5 py-3 flex items-baseline justify-between bg-bg-secondary/50">
          <span className="text-[11px] uppercase tracking-wider text-ink-secondary font-bold">
            Estimated total
          </span>
          <span className="text-[16px] font-bold tabular">{money(total)}</span>
        </div>
      </div>

      {/* 6. Standing-order ask — PR #115's conversion event. Green-tinted
          to align with Brief 4's "green earns its keep at commit" rule. */}
      {standingPromptOpen ? (
        <div
          className="mt-5 rounded-xl border border-brand-green/25 bg-brand-green-tint/60 px-5 py-4"
          role="region"
          aria-label="Save as standing order"
        >
          <div className="text-[11px] uppercase tracking-wider text-brand-green-dark font-bold mb-1">
            Worth a thought
          </div>
          <h3 className="display text-[18px] tracking-tight leading-tight text-ink-primary">
            Want next {deliveryDay ?? "delivery"} to file itself?
          </h3>
          <p className="mt-1 text-[13px] text-ink-secondary leading-snug">
            Auto-send these {lineCount} {lineCount === 1 ? "line" : "lines"} every week. Edit anytime — changes apply to the next run.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveAsStanding}
              disabled={standingSaving}
              className="btn-success text-sm"
            >
              {standingSaving ? "Saving…" : "Set up standing order"}
            </button>
            <button
              type="button"
              onClick={() => setStandingPromptOpen(false)}
              className="btn-ghost text-sm text-brand-green-dark"
            >
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {/* 7. CTAs */}
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href={`/orders/${orderId}`}
          className="btn-primary"
        >
          View order details
        </Link>
        <Link
          href="/guide"
          className="block text-center text-[14px] text-ink-secondary hover:text-ink-primary transition-colors py-2"
        >
          Back to guide
        </Link>
      </div>
    </div>
  );
}
