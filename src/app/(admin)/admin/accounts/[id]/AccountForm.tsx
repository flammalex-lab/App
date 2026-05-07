"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Account, AccountType, AccountStatus, Category, Channel, DeliveryZone, PricingTier } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ZONE_LABELS, BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";

// Buyer-facing product groups as a Category-level toggle. Matches the folding
// used everywhere else in the app: meat = beef+pork+lamb,
// dairy = dairy+eggs (includes cheese, which shares category 'dairy'),
// grocery = pantry+beverages.
type AccountGroup = "meat" | "produce" | "dairy" | "grocery";
const ACCOUNT_GROUPS: AccountGroup[] = ["meat", "produce", "dairy", "grocery"];
const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  meat: "Meat",
  produce: "Produce",
  dairy: "Dairy & Cheese",
  grocery: "Grocery",
};
const ACCOUNT_GROUP_CATS: Record<AccountGroup, Category[]> = {
  meat: ["beef", "pork", "lamb"],
  produce: ["produce"],
  dairy: ["dairy", "eggs"],
  grocery: ["pantry", "beverages"],
};
const ALL_ENABLED_CATS: Category[] = ACCOUNT_GROUPS.flatMap((g) => ACCOUNT_GROUP_CATS[g]);

const ZONE_LIST: DeliveryZone[] = ["finger_lakes", "nyc_metro", "hudson_valley", "long_island", "nj_pa_ct"];
const BUYER_TYPES: BuyerType[] = ["gm_restaurant", "gm_retail", "meat_buyer", "produce_buyer", "dairy_buyer", "cheese_buyer", "grocery_buyer"];

export function AccountForm({ account }: { account: Account | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: account?.name ?? "",
    type: (account?.type ?? "restaurant") as AccountType,
    channel: (account?.channel ?? "foodservice") as Channel,
    pricing_tier: (account?.pricing_tier ?? "standard") as PricingTier,
    status: (account?.status ?? "prospect") as AccountStatus,
    enabled_categories: (account?.enabled_categories ?? ALL_ENABLED_CATS) as Category[],
    buyer_type: (account?.buyer_type ?? "gm_restaurant") as BuyerType,
    primary_contact_name: account?.primary_contact_name ?? "",
    primary_contact_email: account?.primary_contact_email ?? "",
    primary_contact_phone: account?.primary_contact_phone ?? "",
    address_line1: account?.address_line1 ?? "",
    city: account?.city ?? "",
    state: account?.state ?? "NY",
    zip: account?.zip ?? "",
    delivery_zone: (account?.delivery_zone ?? null) as DeliveryZone | null,
    delivery_day: account?.delivery_day ?? "",
    order_minimum: account?.order_minimum ?? "",
    qb_customer_name: account?.qb_customer_name ?? "",
    qb_terms: account?.qb_terms ?? "",
    notes: account?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/accounts/${account?.id ?? "new"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        delivery_zone: form.delivery_zone || null,
        qb_terms: form.qb_terms || null,
        qb_customer_name: form.qb_customer_name || null,
        order_minimum: form.order_minimum === "" ? null : Number(form.order_minimum),
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.push((await res.json()).error ?? "Save failed", "error"); return; }
    toast.push("Account saved", "success");
    const { id } = await res.json();
    if (!account) router.push(`/admin/accounts/${id}`);
    else router.refresh();
  }

  function isGroupOn(group: AccountGroup): boolean {
    return ACCOUNT_GROUP_CATS[group].every((c) => form.enabled_categories.includes(c));
  }
  function toggleGroup(group: AccountGroup) {
    const cats = ACCOUNT_GROUP_CATS[group];
    setForm((f) => {
      const on = cats.every((c) => f.enabled_categories.includes(c));
      const next = on
        ? f.enabled_categories.filter((c) => !cats.includes(c))
        : Array.from(new Set([...f.enabled_categories, ...cats]));
      return { ...f, enabled_categories: next };
    });
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AccountStatus })}>
            {(["prospect", "active", "inactive", "churned"] as AccountStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Type">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
            {(["restaurant", "grocery", "institutional", "country_club", "distributor", "other"] as AccountType[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Channel">
          <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })}>
            {(["foodservice", "retail", "institutional"] as Channel[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Tier">
          <select className="input" value={form.pricing_tier} onChange={(e) => setForm({ ...form, pricing_tier: e.target.value as PricingTier })}>
            {(["standard", "volume", "custom"] as PricingTier[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Buyer type" hint="Which sections this person sees on the catalog — GMs see everything, specialists see only their area">
        <select
          className="input"
          value={form.buyer_type}
          onChange={(e) => setForm({ ...form, buyer_type: e.target.value as BuyerType })}
        >
          {BUYER_TYPES.map((t) => (
            <option key={t} value={t}>{BUYER_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Product groups"
        hint="Upper bound on what this account can order. Individual buyers narrow further via their buyer type."
      >
        <div className="flex flex-wrap gap-2 pt-1">
          {ACCOUNT_GROUPS.map((g) => {
            const on = isGroupOn(g);
            return (
              <label
                key={g}
                className={`px-3 py-1.5 rounded-full border cursor-pointer text-sm ${on ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10"}`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={on}
                  onChange={() => toggleGroup(g)}
                />
                {ACCOUNT_GROUP_LABELS[g]}
              </label>
            );
          })}
        </div>
      </Field>

      <div className="divider" />
      <h3 className="font-serif">Primary contact</h3>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name"><Input value={form.primary_contact_name} onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.primary_contact_email} onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.primary_contact_phone} onChange={(e) => setForm({ ...form, primary_contact_phone: e.target.value })} /></Field>
      </div>

      <div className="divider" />
      <h3 className="font-serif">Delivery</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Zone">
          <select className="input" value={form.delivery_zone ?? ""} onChange={(e) => setForm({ ...form, delivery_zone: (e.target.value || null) as DeliveryZone | null })}>
            <option value="">—</option>
            {ZONE_LIST.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
          </select>
        </Field>
        <Field label="Delivery days"><Input value={form.delivery_day} onChange={(e) => setForm({ ...form, delivery_day: e.target.value })} /></Field>
      </div>
      <Field label="Order minimum ($)">
        <Input value={form.order_minimum as any} onChange={(e) => setForm({ ...form, order_minimum: e.target.value })} />
      </Field>

      <div className="divider" />
      <h3 className="font-serif">QuickBooks</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="QB Customer:Job name" hint="Must match QBD exactly">
          <Input value={form.qb_customer_name} onChange={(e) => setForm({ ...form, qb_customer_name: e.target.value })} />
        </Field>
        <Field label="Terms override" hint="Blank = use default (Net 30)">
          <Input value={form.qb_terms} onChange={(e) => setForm({ ...form, qb_terms: e.target.value })} />
        </Field>
      </div>

      <div className="divider" />
      <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </div>
  );
}
