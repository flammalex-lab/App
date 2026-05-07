"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { relativeTime } from "@/lib/utils/format";

export function AdminMessagesClient({
  accountId,
  adminProfileId,
  initial,
}: {
  accountId: string;
  adminProfileId: string;
  initial: Message[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-msgs:${accountId}`)
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
    await fetch("/api/admin/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, body }),
    });
    setBody("");
    setSending(false);
  }

  return (
    <div className="card flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          const mine = m.from_profile_id === adminProfileId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-brand-green text-white" : "bg-bg-secondary"}`}>
                <div>{m.body}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-ink-secondary"}`}>
                  {m.channel === "sms" ? "📱 " : ""}{m.direction}
                  {" · "}{relativeTime(m.created_at)}
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
          placeholder="Reply to this account (sends via SMS too)"
          className="min-h-[40px]"
        />
        <Button onClick={send} loading={sending}>Send</Button>
      </div>
    </div>
  );
}
