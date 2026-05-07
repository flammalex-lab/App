"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/types";

const BUYER_TYPES: BuyerType[] = [
  "gm_restaurant",
  "gm_retail",
  "meat_buyer",
  "produce_buyer",
  "dairy_buyer",
  "cheese_buyer",
  "grocery_buyer",
];

const INHERIT_VALUE = "__inherit__";

export function BuyerForm({
  profile,
  accountBuyerType,
}: {
  profile: Profile;
  accountBuyerType: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    title: profile.title ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    buyer_type: (profile.buyer_type ?? INHERIT_VALUE) as string,
    notes: profile.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/buyers/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        buyer_type: form.buyer_type === INHERIT_VALUE ? null : form.buyer_type,
        notes: form.notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Save failed", "error");
      return;
    }
    toast.push("Buyer saved", "success");
    router.refresh();
  }

  const inheritedLabel =
    accountBuyerType && BUYER_TYPE_LABELS[accountBuyerType as BuyerType]
      ? BUYER_TYPE_LABELS[accountBuyerType as BuyerType]
      : "account default";

  return (
    <div className="card p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </Field>
      </div>
      <Field label="Title">
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Executive Chef"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" hint="Used to sign in via SMS">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            inputMode="tel"
          />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
        </Field>
      </div>

      <Field
        label="Buyer type"
        hint={`Determines which product groups they see on the catalog. Inherit uses the account default (${inheritedLabel}).`}
      >
        <select
          className="input"
          value={form.buyer_type}
          onChange={(e) => setForm({ ...form, buyer_type: e.target.value })}
        >
          <option value={INHERIT_VALUE}>Inherit from account ({inheritedLabel})</option>
          {BUYER_TYPES.map((t) => (
            <option key={t} value={t}>
              {BUYER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      <div className="flex items-center gap-2 pt-2 border-t border-black/5">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}
