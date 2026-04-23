"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { relativeTime } from "@/lib/utils/format";

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
  const [messages, setMessages] = useState<Message[]>(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

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
      // When there's no account, realtime isn't subscribed so append
      // locally using the echoed row from the API.
      const data = (await res.json().catch(() => ({}))) as { message?: Message };
      if (data.message && !accountId) {
        setMessages((prev) =>
          prev.find((m) => m.id === data.message!.id) ? prev : [...prev, data.message!],
        );
      }
      setBody("");
    } else {
      const { error } = await res.json().catch(() => ({ error: "Send failed" }));
      alert(error ?? "Send failed");
    }
  }

  return (
    <div className="card flex flex-col h-[65vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="h-16 w-16 rounded-full bg-brand-green-tint text-brand-green inline-flex items-center justify-center mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12Z" />
              </svg>
            </div>
            <p className="text-sm text-ink-secondary">Type a message to start a conversation.</p>
          </div>
        ) : null}
        {messages.map((m) => {
          if (m.is_system) return <SystemBubble key={m.id} message={m} />;
          const mine = m.from_profile_id === profileId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-brand-blue text-white" : "bg-bg-secondary"}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-ink-secondary"}`}>
                  {m.channel === "sms" ? "📱 " : ""}
                  {relativeTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-black/5 p-3 flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder="Type a message — your rep will get it via SMS too"
          className="min-h-[40px]"
        />
        <Button onClick={send} loading={sending}>Send</Button>
      </div>
    </div>
  );
}

function SystemBubble({ message }: { message: Message }) {
  // Structured payload is the source of truth for system messages. If no
  // payload or unknown kind, render a plain dashed bubble.
  const payload = message.payload;
  if (payload && payload.kind === "order_placed" && message.related_order_id) {
    const items = Number((payload as any).items ?? 0);
    const deliverIso = ((payload as any).delivery_date ?? (payload as any).pickup_date ?? null) as
      | string
      | null;
    const deliver = deliverIso ? formatShortDeliverDate(deliverIso) : null;
    return (
      <div className="flex flex-col items-start w-full">
        <Link
          href={`/orders/${message.related_order_id}`}
          className="block w-[85%] max-w-[320px] border border-ink-primary/80 rounded-lg bg-white hover:shadow-card transition"
        >
          <div className="px-4 pt-3 pb-2">
            <div className="display text-xl leading-tight">Order</div>
            <div className="text-xs text-ink-secondary mono">
              {String((payload as any).order_number ?? "")}
            </div>
          </div>
          <div className="border-t border-black/10">
            <Row label="Order status" value={<StatusDot label="Pending" />} />
            {deliver ? (
              <Row label="Requested delivery" value={<span className="font-medium">{deliver}</span>} />
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

function StatusDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="h-2 w-2 rounded-full bg-ink-tertiary" />
      {label}
    </span>
  );
}

function formatShortDeliverDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
