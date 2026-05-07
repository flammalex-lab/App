"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityType } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

const TYPES: ActivityType[] = ["call", "email", "visit", "sample_drop", "note", "follow_up"];

export function ActivityLogForm({ accountId }: { accountId: string }) {
  const [type, setType] = useState<ActivityType>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    if (!subject.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/accounts/${accountId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        subject,
        body: body || null,
        follow_up_date: followUp || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSubject("");
      setBody("");
      setFollowUp("");
      router.refresh();
    }
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Dropped off ribeye samples" />
        </Field>
        <Field label="Follow up">
          <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" />
      </Field>
      <Button onClick={save} loading={saving} size="sm">
        Log
      </Button>
    </div>
  );
}
