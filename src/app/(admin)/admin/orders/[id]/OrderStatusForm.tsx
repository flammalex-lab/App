"use client";

import { useState } from "react";
import type { OrderStatus } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Textarea, Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled"];

export function OrderStatusForm({
  orderId,
  currentStatus,
  internalNotes,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  internalNotes: string;
}) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [notes, setNotes] = useState(internalNotes);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, internal_notes: notes }),
    });
    setSaving(false);
    if (res.ok) toast.push(`Status → ${status}`, "success");
    else toast.push("Error saving", "error");
  }

  return (
    <div className="card mt-4 p-4 space-y-3">
      <Field label="Status">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Internal notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </div>
  );
}
