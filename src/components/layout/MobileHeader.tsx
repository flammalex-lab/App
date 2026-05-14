"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/Brand";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { countdown, titleCase } from "@/lib/utils/format";
import { useCart } from "@/lib/cart/store";
import type { Account, Profile } from "@/lib/supabase/types";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

interface Props {
  home: string;
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
  next: SerializedNextDelivery | null;
}

function titleForPath(path: string): string {
  if (path.startsWith("/guide")) return "My guide";
  if (path.startsWith("/catalog")) return "Catalog";
  if (path.startsWith("/cart")) return "Cart";
  if (path.startsWith("/orders")) return "Orders";
  if (path.startsWith("/standing")) return "Standing";
  if (path.startsWith("/chat")) return "Chat";
  if (path.startsWith("/account")) return "Account";
  return "Fingerlakes Farms";
}

/**
 * Mobile-only chrome (md:hidden). One 52px bar replaces the previous
 * stacked cutoff strip + nav header (96px total). Carries: brand mark,
 * page identity, cutoff sub-line, and a single overflow trigger.
 *
 * Cart access on mobile is via StickyCartBar — no cart icon here.
 */
export function MobileHeader({ home, profile, activeAccount, memberships, next }: Props) {
  const pathname = usePathname() ?? "/";
  const title = titleForPath(pathname);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // The StickyCartBar pill owns urgency when (a) cart has lines and (b)
  // cutoff is within 12h. While that's true, the header strip demotes to
  // a quiet delivery-date-only line so urgency isn't double-rendered.
  const cartLineCount = useCart((s) => s.lines.length);
  const ms = next ? new Date(next.cutoffAt).getTime() - now : null;
  const pillOwnsCountdown =
    cartLineCount > 0 && ms != null && ms > 0 && ms < 12 * 60 * 60 * 1000;

  return (
    <header className="md:hidden bg-white border-b border-black/[0.06] h-[52px] flex items-center gap-2.5 px-3.5">
      <Link href={home} aria-label="Home" className="shrink-0 inline-flex">
        <BrandLogo size={28} />
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-px">
        <div className="display text-base font-bold tracking-tight leading-[1.1] text-ink-primary truncate">
          {title}
        </div>
        {pillOwnsCountdown ? (
          <DemotedDeliveryLine next={next} onOpen={() => setCutoffOpen(true)} />
        ) : (
          <CutoffLine next={next} now={now} onOpen={() => setCutoffOpen(true)} />
        )}
      </div>

      <button
        type="button"
        className="shrink-0 h-11 w-11 -mr-1 inline-flex items-center justify-center rounded-md text-ink-primary hover:bg-bg-secondary transition-colors duration-150"
        aria-label="More options"
        aria-haspopup="dialog"
        aria-expanded={overflowOpen}
        onClick={() => setOverflowOpen(true)}
      >
        <DotsIcon />
      </button>

      <CutoffSheet
        open={cutoffOpen}
        onClose={() => setCutoffOpen(false)}
        next={next}
        now={now}
      />
      <OverflowSheet
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        profile={profile}
        activeAccount={activeAccount}
        memberships={memberships}
      />
    </header>
  );
}

/**
 * Demoted variant of CutoffLine — shown when the StickyCartBar pill is
 * carrying the urgency. Quiet, delivery-date-only, no countdown, no dot.
 * Still tappable so the buyer can open the cutoff sheet if they want the
 * full picture.
 */
function DemotedDeliveryLine({
  next,
  onOpen,
}: {
  next: SerializedNextDelivery | null;
  onOpen: () => void;
}) {
  if (!next) return null;
  const d = new Date(next.deliveryDate);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Delivery details"
      className="text-[11px] leading-tight text-ink-tertiary text-left truncate"
    >
      Delivery{" "}
      <span className="tabular">
        {d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </span>
    </button>
  );
}

function CutoffLine({
  next,
  now,
  onOpen,
}: {
  next: SerializedNextDelivery | null;
  now: number;
  onOpen: () => void;
}) {
  if (!next) {
    return (
      <span className="text-[11px] leading-tight text-ink-tertiary truncate">
        Delivery zone not set
      </span>
    );
  }
  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const urgent = !past && ms < 60 * 60 * 1000;
  const dotTone = past || urgent ? "bg-feedback-error animate-pulse" : "bg-accent-gold";
  const timeTone = past || urgent ? "text-feedback-error" : "text-ink-primary";

  const cutoffDate = new Date(next.cutoffAt);
  const wd = cutoffDate.toLocaleString("en-US", { weekday: "short" });
  const hour = cutoffDate
    .toLocaleString("en-US", { hour: "numeric", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Delivery details"
      className="flex items-center gap-1.5 text-[11px] leading-tight text-ink-secondary text-left min-w-0"
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotTone}`} aria-hidden />
      <span className="truncate">
        {wd} {hour} cutoff
      </span>
      <span aria-hidden className="opacity-60">·</span>
      <span className={`tabular font-semibold shrink-0 ${timeTone}`}>
        {past ? "past" : countdown(ms)}
      </span>
    </button>
  );
}

function CutoffSheet({
  open,
  onClose,
  next,
  now,
}: {
  open: boolean;
  onClose: () => void;
  next: SerializedNextDelivery | null;
  now: number;
}) {
  if (!next) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Delivery & cutoff">
        <div className="px-5 py-5 text-sm text-ink-secondary">
          Delivery zone not set yet. Ask your rep to assign one.
        </div>
      </BottomSheet>
    );
  }
  const ms = new Date(next.cutoffAt).getTime() - now;
  const past = ms <= 0;
  const urgent = !past && ms < 60 * 60 * 1000;
  const warn = !past && !urgent && ms < 12 * 60 * 60 * 1000;
  const deliveryDate = new Date(next.deliveryDate);
  const tone =
    past || urgent
      ? "bg-feedback-error/10 text-feedback-error"
      : warn
        ? "bg-accent-gold/15 text-[#7a5a12]"
        : "bg-brand-blue-tint text-brand-blue-dark";

  return (
    <BottomSheet open={open} onClose={onClose} title="Delivery & cutoff">
      <div className="px-5 py-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
            <CalendarIcon />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-secondary font-medium">
              Next delivery
            </div>
            <div className="display text-xl tracking-tight">
              {next.deliveryDayName},{" "}
              {deliveryDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
            <ClockIcon />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-secondary font-medium">
              Cutoff
            </div>
            <div className="display text-xl tracking-tight">
              {past ? "Passed" : `${countdown(ms)} remaining`}
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
          Orders placed after the cutoff are queued for the next available delivery date.
          Need a special arrangement?{" "}
          <Link href="/chat" className="text-brand-blue underline" onClick={onClose}>
            Message your rep
          </Link>
          .
        </p>
      </div>
    </BottomSheet>
  );
}

function OverflowSheet({
  open,
  onClose,
  profile,
  activeAccount,
  memberships,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const multi = memberships.length > 1;

  async function pick(accountId: string) {
    if (accountId === activeAccount?.id) {
      onClose();
      return;
    }
    setSwitching(accountId);
    const res = await fetch("/api/account/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    setSwitching(null);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      alert("Could not switch account");
    }
  }

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    profile.phone ||
    "";

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="More options">
      <div className="px-5 pt-4 pb-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium">
          Signed in as
        </div>
        <div className="display text-lg tracking-tight">{fullName}</div>
        {activeAccount ? (
          <div className="text-[12px] text-ink-secondary mt-0.5 truncate">
            On {titleCase(activeAccount.name)}
          </div>
        ) : null}
      </div>

      {multi ? (
        <div className="border-t border-black/[0.06]">
          <div className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-wide text-ink-tertiary font-medium">
            Switch account
          </div>
          <ul>
            {memberships.map((a) => {
              const isActive = a.id === activeAccount?.id;
              const display = titleCase(a.name);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a.id)}
                    disabled={switching !== null}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left ${
                      isActive ? "bg-brand-blue-tint" : "hover:bg-bg-secondary"
                    }`}
                  >
                    <span className="h-8 w-8 rounded-full bg-accent-gold/30 text-[#6a4d06] inline-flex items-center justify-center display text-xs shrink-0">
                      {display[0] ?? "?"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-sm truncate">{display}</span>
                      {a.city ? (
                        <span className="block text-[11px] text-ink-secondary truncate">
                          {a.city}
                          {a.state ? `, ${a.state}` : ""}
                        </span>
                      ) : null}
                    </span>
                    {isActive ? (
                      <span className="text-[11px] font-medium text-brand-blue shrink-0">
                        Active
                      </span>
                    ) : switching === a.id ? (
                      <span className="text-[11px] text-ink-secondary shrink-0">Switching…</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ul className="border-t border-black/[0.06] py-1">
        <OverflowLink href="/account" label="Account & settings" onClick={onClose} />
        <OverflowLink href="/standing" label="Standing orders" onClick={onClose} />
      </ul>

      <form action="/auth/signout" method="post" className="border-t border-black/[0.06]">
        <button
          type="submit"
          className="w-full text-left px-5 py-3 text-sm font-medium text-feedback-error hover:bg-bg-secondary"
        >
          Sign out
        </button>
      </form>
    </BottomSheet>
  );
}

function OverflowLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center justify-between px-5 py-3 text-sm hover:bg-bg-secondary"
      >
        <span>{label}</span>
        <span aria-hidden className="text-ink-tertiary">
          ›
        </span>
      </Link>
    </li>
  );
}

function DotsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </svg>
  );
}

function CalendarIcon() {
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
