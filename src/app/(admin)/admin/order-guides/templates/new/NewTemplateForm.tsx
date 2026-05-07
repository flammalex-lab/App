"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";

const BUYER_TYPES: BuyerType[] = [
  "gm_restaurant",
  "gm_retail",
  "meat_buyer",
  "produce_buyer",
  "dairy_buyer",
  "cheese_buyer",
  "grocery_buyer",
];

export interface TemplateSourceOption {
  id: string;
  name: string;
  buyer_type: string | null;
  itemCount: number;
}

export function NewTemplateForm({ sources }: { sources: TemplateSourceOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [buyerType, setBuyerType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [seedFrom, setSeedFrom] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.push("Name required", "error");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/order-guide-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        buyer_type: buyerType || null,
        description: description.trim() || null,
        seed_from_template_id: seedFrom || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Create failed", "error");
      return;
    }
    const { id, seeded } = (await res.json()) as { id: string; seeded: number };
    toast.push(
      seeded > 0 ? `Template created · cloned ${seeded} items` : "Template created",
      "success",
    );
    router.push(`/admin/order-guides/templates/${id}`);
  }

  const seedSourceLabel =
    seedFrom && sources.find((s) => s.id === seedFrom)?.itemCount
      ? `${sources.find((s) => s.id === seedFrom)!.itemCount} items will be copied`
      : "Start empty";

  return (
    <div className="card p-5 space-y-3">
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lincoln Market Dairy"
          autoFocus
        />
      </Field>
      <Field
        label="Suggested buyer type (optional)"
        hint="Surfaces this template as a matching default when adding a buyer of this type."
      >
        <select
          className="input"
          value={buyerType}
          onChange={(e) => setBuyerType(e.target.value)}
        >
          <option value="">No association</option>
          {BUYER_TYPES.map((t) => (
            <option key={t} value={t}>
              {BUYER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Seed from existing template (optional)"
        hint={seedSourceLabel}
      >
        <select className="input" value={seedFrom} onChange={(e) => setSeedFrom(e.target.value)}>
          <option value="">— start empty —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.buyer_type ? ` · ${BUYER_TYPE_LABELS[s.buyer_type as BuyerType] ?? s.buyer_type}` : ""}
              {" "}({s.itemCount})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description (optional)">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this template is for, reminders for the admin, etc."
        />
      </Field>
      <div className="pt-2">
        <Button onClick={save} loading={saving}>
          Create
        </Button>
      </div>
    </div>
  );
}
