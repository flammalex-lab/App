"use client";

import { useState } from "react";
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

export function AddBuyerDialog({
  accountId,
  accountBuyerType,
}: {
  accountId: string;
  accountBuyerType: string | null;
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

  function close() {
    setOpen(false);
    setForm({
      name: "",
      phone: "",
      email: "",
      title: "",
      buyer_type: (accountBuyerType ?? "gm_restaurant") as BuyerType,
    });
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
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Failed to add buyer", "error");
      return;
    }
    const { profileId } = (await res.json()) as { profileId: string };
    toast.push("Buyer added · opening their guide", "success");
    router.push(`/admin/accounts/${accountId}/guide/${profileId}`);
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add buyer
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-md p-5 space-y-3">
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
          hint="Restricts what this buyer sees on the catalog (produce buyer → produce only). Overrides the account default."
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

        <p className="text-xs text-ink-tertiary pt-1">
          After saving, you&rsquo;ll land on this buyer&rsquo;s guide editor to
          add the specific items they should see first (e.g. Barrel Brine,
          Saturn Valley Farm).
        </p>

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
