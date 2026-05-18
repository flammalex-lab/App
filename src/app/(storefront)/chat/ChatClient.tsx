"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import type { Message, MessagePayload } from "@/lib/supabase/types";
import { relativeTime, dateShort } from "@/lib/utils/format";
import { track } from "@/lib/analytics/track";

const REP_NAME = process.env.NEXT_PUBLIC_REP_NAME || "Your rep";
const REP_ROLE = "Your rep at Fingerlakes Farms";
const UNLINKED_ROLE = "Messages go to our team — we'll pair you with a rep";

// Quick-action chips. Each chip drops a starter template into the
// composer so the buyer can edit & send. Cursor lands at the end of
// the prefill so the buyer can keep typing (the chips with trailing
// spaces — "add to order", "ask product", etc. — let the buyer dictate
// the rest inline).
const QUICK_ACTIONS: ReadonlyArray<{
  key: string;
  label: string;
  prefill: string;
}> = [
  {
    key: "adjust-delivery",
    label: "Adjust a delivery",
    prefill: "Hey — can I change the delivery date on my next order?",
  },
  {
    key: "add-to-order",
    label: "Add to my order",
    prefill: "Can you add to my next order: ",
  },
  {
    key: "ask-product",
    label: "Ask about a product",
    prefill: "Quick question about ",
  },
  {
    key: "pause-standing",
    label: "Pause my standing order",
    prefill: "Can we pause my standing order for ",
  },
  {
    key: "substitute",
    label: "Substitute an item",
    prefill: "If you're short on ",
  },
];

export function ChatClient({
  accountId,
  profileId,
  initial,
}: {
  accountId: string | null;
  profileId: string;
  initial: Message[];
}) {
  const supabase = createClient();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    track("chat_viewed", { message_count: initial.length });
  }, [initial.length]);

  useEffect(() => {
    // Without an account the realtime channel has nothing to filter on
    // reliably — skip the subscription; the page will still show any
    // messages the buyer sent, and sends succeed regardless.
    if (!accountId) return;
    const channel = supabase
      .channel(`messages:${accountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `account_id=eq.${accountId}` },
        (payload) => {
          setMessages((prev) =>
            prev.find((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message],
          );
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [accountId, supabase]);

  // Pin the chat to the newest message. We set scrollTop on the inner
  // overflow container directly (instead of scrollIntoView on a sentinel,
  // which scrolls the whole window when the chat is taller than the
  // viewport — that was yanking the page down on open).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  // Stockout-flow prefill: /chat?sku=...&context=... lands here when the
  // buyer taps "Ask Alex" on a /guide stockout row. Drop a starter into
  // the composer so the buyer can edit & send without retyping which
  // product they're asking about. One-shot — wipes after first apply so
  // a refresh doesn't re-prefill over the buyer's edits.
  const searchParams = useSearchParams();
  const ctxParam = searchParams?.get("context") ?? null;
  const skuParam = searchParams?.get("sku") ?? null;
  // Sync state from URL params during render (canonical React 19 pattern
  // for "set state when a derived input changes"). Falls back to ref so
  // a refresh after an edit doesn't re-prefill over the buyer's typing.
  const [lastCtx, setLastCtx] = useState<string | null>(null);
  if (ctxParam && ctxParam !== lastCtx) {
    setLastCtx(ctxParam);
    const skuTag = skuParam ? ` (${skuParam})` : "";
    setBody(`${ctxParam}${skuTag} — what's a good swap?`);
  }
  useEffect(() => {
    if (!ctxParam) return;
    // Focus the composer once the prefill has rendered.
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    });
  }, [ctxParam]);

  // Auto-grow the textarea between 3–6 rows. We measure scrollHeight
  // against a 3-row baseline (taller default per buyer feedback) and clamp
  // to a max so it never eats the whole screen on a paragraph-long message.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20; // matches text-sm leading-snug
    const padding = 16; // py-2 top+bottom
    const min = lineHeight * 3 + padding; // 76px baseline ≈ min-h-[88px] floor
    const max = lineHeight * 6 + padding;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, min), max)}px`;
  }, [body]);

  function applyQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    setBody(action.prefill);
    // Focus the textarea and drop the caret at the end of the prefill
    // so the buyer can keep typing without repositioning.
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = action.prefill.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        // Older browsers may throw on programmatic caret moves; ignore.
      }
    });
  }

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) {
      // Optimistically append the echoed message to local state regardless
      // of whether realtime is wired. Buyer feedback: messages weren't
      // appearing in their own chat after send. Root cause: realtime
      // filters on `account_id=eq.${accountId}`, but the POST handler
      // re-resolves the active account server-side — for buyers with
      // multiple memberships those can disagree, the insert lands on a
      // different account thread than the subscription is listening to,
      // and the buyer's UI never echoes their own message. Appending
      // locally on send is what every chat UI does anyway. The realtime
      // listener's `.find((m) => m.id === ...)` dedupe (line 82) prevents
      // a double-append if realtime ALSO catches it.
      const data = (await res.json().catch(() => ({}))) as { message?: Message };
      if (data.message) {
        setMessages((prev) =>
          prev.find((m) => m.id === data.message!.id) ? prev : [...prev, data.message!],
        );
      }
      setBody("");
    } else {
      const { error } = await res.json().catch(() => ({ error: "Send failed" }));
      toast.push(error ?? "Send failed", "error");
    }
  }

  return (
    // Full-bleed surface. Escapes the storefront <main>'s px/py/pb padding
    // via negative margins so the chat owns its rectangle between the
    // sticky header and the bottom tab bar. dvh keeps the height honest
    // on mobile when the URL bar shows/hides. Heights account for chrome:
    //   - mobile: 52px MobileHeader
    //   - md+:    ~28px CutoffClock + ~58px DesktopHeader ≈ 86px
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-1 -mb-32 flex flex-col bg-white h-[calc(100dvh-52px)] md:h-[calc(100dvh-86px)]">
      <RepHeader online linked={!!accountId} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-2"
      >
        {messages.length === 0 ? <EmptyState linked={!!accountId} /> : null}
        {messages.map((m) => {
          if (m.is_system) return <SystemBubble key={m.id} message={m} />;
          const mine = m.from_profile_id === profileId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] md:max-w-[560px] lg:max-w-[680px] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "bg-brand-blue text-white rounded-br-md"
                    : "bg-bg-secondary text-ink-primary rounded-bl-md"
                }`}
              >
                <div className="whitespace-pre-wrap leading-snug">{m.body}</div>
                <div
                  className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-ink-tertiary"}`}
                >
                  {m.channel === "sms" ? "SMS · " : ""}
                  {relativeTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Composer
        body={body}
        onChange={setBody}
        onSend={send}
        sending={sending}
        textareaRef={textareaRef}
        onQuickAction={applyQuickAction}
      />
    </div>
  );
}

function RepHeader({ online, linked }: { online: boolean; linked: boolean }) {
  const initials = REP_NAME.split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const subtitle = linked ? REP_ROLE : UNLINKED_ROLE;
  const showOnline = online && linked;
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-black/[0.06] bg-white">
      <div className="relative h-10 w-10 rounded-full bg-accent-gold/30 text-[#6a4d06] inline-flex items-center justify-center display text-sm shrink-0">
        {initials || "?"}
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${
            showOnline ? "bg-brand-green" : "bg-ink-tertiary"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="display text-base leading-tight truncate">
          {linked ? REP_NAME : "Fingerlakes Farms team"}
        </div>
        <div className="text-[11px] text-ink-secondary leading-tight truncate">
          {showOnline ? (
            <>
              <span className="text-brand-green-dark font-medium">Online</span>
              <span aria-hidden className="opacity-60"> · </span>
            </>
          ) : null}
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ linked }: { linked: boolean }) {
  const repFirst = REP_NAME.split(" ")[0];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-6 py-10">
      <div className="h-14 w-14 rounded-full bg-brand-green-tint text-brand-green inline-flex items-center justify-center mb-4">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
      </div>
      {linked ? (
        <>
          <p className="display text-lg leading-snug max-w-xs">
            You can text {repFirst} about anything.
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed mt-2 max-w-sm">
            Adjust a delivery date, add to your next order, ask about a
            product, or anything else. Messages go to {repFirst} via SMS —
            he&apos;ll reply back here.
          </p>
        </>
      ) : (
        <>
          <p className="display text-lg leading-snug max-w-xs">
            Say hello — we&apos;ll pair you with a rep.
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed mt-2 max-w-sm">
            You&apos;re not linked to an account yet. Drop us a message and
            our team will get back to you here.
          </p>
        </>
      )}
    </div>
  );
}

function Composer({
  body,
  onChange,
  onSend,
  sending,
  textareaRef,
  onQuickAction,
}: {
  body: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onQuickAction: (action: (typeof QUICK_ACTIONS)[number]) => void;
}) {
  const canSend = body.trim().length > 0 && !sending;
  return (
    // Composer parks at the bottom of the chat column. On mobile we lift
    // the bottom edge above the 60px BottomTabs + iOS home indicator so
    // the input never sits under the tab bar (mirrors StickyCartBar's
    // `bottom: env(safe-area-inset-bottom) + 60px` pattern). On md+ the
    // bottom tabs hide, so a slim default suffices.
    <div className="shrink-0 border-t border-black/[0.06] bg-white pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:pb-3">
      <div
        className="overflow-x-auto px-4 md:px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Quick actions"
      >
        <div className="flex items-center gap-2 w-max">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="listitem"
              onClick={() => onQuickAction(a)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white hover:border-brand-blue hover:text-brand-blue text-xs font-medium text-ink-primary px-3 py-1.5 transition-colors duration-150 active:scale-[0.98]"
            >
              <PlusGlyph />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2 px-3 md:px-6 pt-1">
        <div className="flex-1 flex items-end rounded-2xl border border-black/10 bg-white focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/30 transition-colors duration-150">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend();
            }}
            rows={3}
            placeholder="Message your rep — replies via SMS too"
            className="flex-1 resize-none bg-transparent px-3.5 py-2 text-sm leading-snug outline-none placeholder:text-ink-tertiary max-h-[160px] min-h-[88px]"
          />
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand-blue text-white disabled:opacity-40 disabled:pointer-events-none hover:bg-brand-blue-dark transition-colors duration-150 active:scale-[0.96]"
        >
          {sending ? <SpinnerGlyph /> : <SendGlyph />}
        </button>
      </div>
    </div>
  );
}

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: "bg-brand-blue-tint", text: "text-brand-blue", label: "Confirmed" },
  processing: { bg: "bg-brand-blue-tint", text: "text-brand-blue", label: "Being prepped" },
  ready: { bg: "bg-brand-green-tint", text: "text-brand-green-dark", label: "Ready for pickup" },
  shipped: { bg: "bg-brand-green-tint", text: "text-brand-green-dark", label: "Out for delivery" },
  delivered: { bg: "bg-brand-green-tint", text: "text-brand-green-dark", label: "Delivered" },
  cancelled: { bg: "bg-[#fde9e3]", text: "text-[#7a3b1f]", label: "Cancelled" },
};

function SystemBubble({ message }: { message: Message }) {
  // Structured payload is the source of truth for system messages. If no
  // payload or unknown kind, render a plain dashed bubble.
  // payload is jsonb in the DB; cast to the discriminated union here.
  const payload = (message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
    ? (message.payload as unknown as MessagePayload)
    : null);
  if (payload && payload.kind === "order_status" && message.related_order_id) {
    const status = String((payload as { status?: unknown }).status ?? "");
    const orderNumber = String((payload as { order_number?: unknown }).order_number ?? "");
    const pill = STATUS_PILL[status] ?? {
      bg: "bg-bg-secondary",
      text: "text-ink-secondary",
      label: status,
    };
    return (
      <div className="flex flex-col items-start w-full">
        <Link
          href={`/orders/${message.related_order_id}`}
          className="block w-[85%] max-w-[320px] md:max-w-[440px] lg:max-w-[480px] rounded-lg bg-white border border-black/10 hover:shadow-card transition px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-ink-tertiary uppercase tracking-wider mono">
                {orderNumber}
              </div>
              <div className="text-[14px] font-medium leading-snug truncate">
                {message.body}
              </div>
            </div>
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${pill.bg} ${pill.text}`}
            >
              {pill.label}
            </span>
          </div>
        </Link>
        <div className="text-[10px] mt-1 text-ink-tertiary">{relativeTime(message.created_at)}</div>
      </div>
    );
  }
  if (payload && payload.kind === "order_placed" && message.related_order_id) {
    const items = Number((payload as { items?: unknown }).items ?? 0);
    const deliverIso = ((payload as { delivery_date?: unknown; pickup_date?: unknown }).delivery_date
      ?? (payload as { delivery_date?: unknown; pickup_date?: unknown }).pickup_date
      ?? null) as string | null;
    const deliver = deliverIso ? dateShort(deliverIso) : null;
    return (
      <div className="flex flex-col items-start w-full">
        <Link
          href={`/orders/${message.related_order_id}`}
          className="block w-[85%] max-w-[320px] md:max-w-[440px] lg:max-w-[480px] border border-ink-primary/80 rounded-lg bg-white hover:shadow-card transition"
        >
          <div className="px-4 pt-3 pb-2">
            <div className="display text-xl leading-tight">Order</div>
            <div className="text-xs text-ink-secondary mono">
              {String((payload as { order_number?: unknown }).order_number ?? "")}
            </div>
          </div>
          <div className="border-t border-black/10">
            {/* No "Order status" row — the placement bubble represents the
                moment of placement, not current state. Live status changes
                fire their own colored bubbles via payload.kind="order_status"
                (admin-driven transitions). Showing "Pending" here forever
                read stale after the order was cancelled or fulfilled. */}
            {deliver ? (
              <Row label="Delivery date" value={<span className="font-medium">{deliver}</span>} />
            ) : null}
            <Row
              label="Ordered products"
              value={
                <span className="font-medium">
                  {items} {items === 1 ? "product" : "products"}
                </span>
              }
            />
          </div>
          <div className="px-4 py-2.5 text-center text-sm font-semibold text-brand-blue uppercase tracking-wide">
            View details
          </div>
        </Link>
        <div className="text-[10px] mt-1 text-ink-tertiary">{relativeTime(message.created_at)}</div>
      </div>
    );
  }

  // Fallback: plain dashed bubble (non-order system posts, or legacy
  // messages that predate the payload column).
  const inner = (
    <div className="max-w-[85%] mx-auto rounded-lg border border-dashed border-black/15 bg-bg-secondary px-3 py-2 text-xs text-ink-secondary">
      <div className="whitespace-pre-wrap">{message.body}</div>
      <div className="text-[10px] mt-1 text-ink-tertiary">{relativeTime(message.created_at)}</div>
    </div>
  );
  return (
    <div className="flex justify-center">
      {message.related_order_id ? (
        <Link href={`/orders/${message.related_order_id}`} className="w-full flex justify-center hover:opacity-90">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-black/10 last:border-b-0 text-sm">
      <span className="text-ink-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendGlyph() {
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
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function SpinnerGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
