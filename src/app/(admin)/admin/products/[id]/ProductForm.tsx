"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Category, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";

export function ProductForm({ product }: { product: Product | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    brand: (product?.brand ?? "grasslands") as Brand,
    category: (product?.category ?? "beef") as Category,
    name: product?.name ?? "",
    description: product?.description ?? "",
    pack_size: product?.pack_size ?? "",
    case_pack: product?.case_pack ?? "",
    unit: product?.unit ?? "lb",
    avg_weight_lbs: product?.avg_weight_lbs ?? "",
    wholesale_price: product?.wholesale_price ?? "",
    retail_price: product?.retail_price ?? "",
    qb_income_account: product?.qb_income_account ?? "",
    available_b2b: product?.available_b2b ?? true,
    available_dtc: product?.available_dtc ?? false,
    available_this_week: product?.available_this_week ?? true,
    is_active: product?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setSaving(true);
    const res = await fetch(`/api/admin/products/${product?.id ?? "new"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        avg_weight_lbs: form.avg_weight_lbs === "" ? null : Number(form.avg_weight_lbs),
        wholesale_price: form.wholesale_price === "" ? null : Number(form.wholesale_price),
        retail_price: form.retail_price === "" ? null : Number(form.retail_price),
        qb_income_account: form.qb_income_account || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { setErr((await res.json()).error ?? "Save failed"); return; }
    const { id } = await res.json();
    router.push(`/admin/products/${id}`);
    router.refresh();
  }

  async function del() {
    if (!product) return;
    if (!confirm("Delete this product? Orders that reference it will keep their history.")) return;
    await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        <Field label="Brand">
          <select className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value as Brand })}>
            {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pack size"><Input value={form.pack_size} onChange={(e) => setForm({ ...form, pack_size: e.target.value })} /></Field>
        <Field label="Case pack"><Input value={form.case_pack} onChange={(e) => setForm({ ...form, case_pack: e.target.value })} /></Field>
        <Field label="Avg weight (lb)"><Input value={form.avg_weight_lbs as any} onChange={(e) => setForm({ ...form, avg_weight_lbs: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Wholesale price"><Input value={form.wholesale_price as any} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} /></Field>
        <Field label="Retail price"><Input value={form.retail_price as any} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} /></Field>
      </div>
      <Field label="QB income account override" hint="Blank = use category default from QB settings">
        <Input value={form.qb_income_account} onChange={(e) => setForm({ ...form, qb_income_account: e.target.value })} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_b2b} onChange={(e) => setForm({ ...form, available_b2b: e.target.checked })} /> Available B2B</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_dtc} onChange={(e) => setForm({ ...form, available_dtc: e.target.checked })} /> Available DTC</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_this_week} onChange={(e) => setForm({ ...form, available_this_week: e.target.checked })} /> In stock this week</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={save} loading={saving}>Save</Button>
        {product ? <Button onClick={del} variant="danger">Delete</Button> : null}
        {err ? <span className="text-sm text-feedback-error">{err}</span> : null}
      </div>
    </div>
  );
}
