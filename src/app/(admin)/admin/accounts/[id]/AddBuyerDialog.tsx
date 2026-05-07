"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
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

export interface TemplateOption {
  id: string;
  name: string;
  buyer_type: string | null;
  itemCount: number;
}

export function AddBuyerDialog({
  accountId,
  accountBuyerType,
  templates,
}: {
  accountId: string;
  accountBuyerType: string | null;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    title: "",
    buyer_type: (accountBuyerType ?? "gm_restaurant") as BuyerType,
  });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  function close() {
    setOpen(false);
    setForm({
      name: "",
      phone: "",
      email: "",
      title: "",
      buyer_type: (accountBuyerType ?? "gm_restaurant") as BuyerType,
    });
    setSelectedTemplateIds([]);
  }

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.push("Name and phone are required", "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/accounts/${accountId}/invite-buyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        title: form.title.trim() || null,
        buyer_type: form.buyer_type,
        template_ids: selectedTemplateIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Failed to add buyer", "error");
      return;
    }
    const { seeded } = (await res.json()) as { seeded?: number };
    toast.push(
      seeded && seeded > 0
        ? `Buyer added · guide seeded with ${seeded} items`
        : "Buyer added",
      "success",
    );
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add buyer
      </Button>
    );
  }

  // Group templates by buyer_type and suggest ones matching the picked type.
  const groupedTemplates = groupByBuyerType(templates);
  const suggested = templates.filter((t) => t.buyer_type === form.buyer_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-lg p-5 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex items-baseline justify-between">
          <h3 className="display text-lg">Add buyer</h3>
          <button
            type="button"
            onClick={close}
            className="text-ink-tertiary hover:text-ink-primary text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chef Hugh"
              autoFocus
            />
          </Field>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Executive Chef"
            />
          </Field>
        </div>

        <Field label="Phone" hint="US number; they'll sign in with this">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(555) 123-4567"
            inputMode="tel"
          />
        </Field>

        <Field label="Email (optional)">
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="chef.hugh@restaurant.com"
            type="email"
          />
        </Field>

        <Field
          label="Buyer type"
          hint="Restricts what this buyer sees on the catalog. Overrides the account default."
        >
          <select
            className="input"
            value={form.buyer_type}
            onChange={(e) => setForm({ ...form, buyer_type: e.target.value as BuyerType })}
          >
            {BUYER_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUYER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label">Starter templates</label>
            <Link
              href="/admin/order-guides/templates"
              className="text-xs text-brand-blue hover:underline"
              target="_blank"
            >
              Manage templates ↗
            </Link>
          </div>
          <p className="text-xs text-ink-secondary mb-2">
            Pick one or more. Items from all picked templates are combined and
            deduped to seed this buyer&rsquo;s guide. Leave empty for a blank
            guide the buyer curates themselves.
          </p>
          {templates.length === 0 ? (
            <div className="text-xs text-ink-tertiary italic">
              No templates yet.{" "}
              <Link href="/admin/order-guides/templates/new" className="underline text-brand-blue" target="_blank">
                Create one →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {suggested.length > 0 && selectedTemplateIds.length === 0 ? (
                <p className="text-[11px] text-ink-tertiary">
                  Suggested for {BUYER_TYPE_LABELS[form.buyer_type]}:{" "}
                  {suggested.map((t) => t.name).join(", ")}
                </p>
              ) : null}
              {Object.entries(groupedTemplates).map(([bt, list]) => (
                <div key={bt}>
                  <div className="text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">
                    {bt === "_none" ? "General" : BUYER_TYPE_LABELS[bt as BuyerType]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((t) => {
                      const on = selectedTemplateIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTemplate(t.id)}
                          className={`px-3 py-1 rounded-full border text-xs transition ${
                            on
                              ? "bg-brand-blue text-white border-brand-blue"
                              : "bg-white text-ink-primary border-black/10 hover:bg-bg-secondary"
                          }`}
                        >
                          {t.name}
                          <span className={`ml-1 tabular ${on ? "opacity-80" : "text-ink-tertiary"}`}>
                            {t.itemCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Add buyer
          </Button>
        </div>
      </div>
    </div>
  );
}

function groupByBuyerType(templates: TemplateOption[]): Record<string, TemplateOption[]> {
  const out: Record<string, TemplateOption[]> = {};
  for (const t of templates) {
    const key = t.buyer_type ?? "_none";
    (out[key] ??= []).push(t);
  }
  return out;
}
