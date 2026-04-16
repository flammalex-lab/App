"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

export function ActivityComposer() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

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
      setBody("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left card px-4 py-3 text-ink-secondary hover:bg-bg-secondary transition"
      >
        Message your rep at Fingerlakes Farms…
      </button>
    );
  }

  return (
    <div className="card p-3 space-y-2">
      <Textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message your rep — they'll get a text"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
          Cancel
        </Button>
        <Button onClick={send} loading={sending} size="sm">
          Send
        </Button>
      </div>
    </div>
  );
}
