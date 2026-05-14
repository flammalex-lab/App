"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand, Category, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";

export function ProductForm({ product }: { product: Product | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    brand: (product?.brand ?? "grasslands") as Brand,
    producer: product?.producer ?? "",
    category: (product?.category ?? "meat") as Category,
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
    private: product?.private ?? false,
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/products/${product?.id ?? "new"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        producer: form.producer.trim() || null,
        avg_weight_lbs: form.avg_weight_lbs === "" ? null : Number(form.avg_weight_lbs),
        wholesale_price: form.wholesale_price === "" ? null : Number(form.wholesale_price),
        retail_price: form.retail_price === "" ? null : Number(form.retail_price),
        qb_income_account: form.qb_income_account || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.push((await res.json()).error ?? "Save failed", "error"); return; }
    toast.push("Product saved", "success");
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
      {product ? (
        <ProductImageEditor product={product} />
      ) : (
        <div className="text-xs text-ink-tertiary -mb-1">
          Save the product first, then a photo control will appear here.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU"><Input name="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        <Field label="Brand">
          <select name="brand" className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value as Brand })}>
            {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Name"><Input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field
        label="Producer"
        hint="Free-text farm/producer byline shown on the buyer-facing card. Defaults to &ldquo;Fingerlakes Farms&rdquo; for own/co-packed items via migration 0029."
      >
        <Input
          name="producer"
          value={form.producer}
          onChange={(e) => setForm({ ...form, producer: e.target.value })}
          placeholder="e.g. Five Acre Farms"
        />
      </Field>
      <Field label="Description"><Textarea name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select name="category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Unit"><Input name="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pack size"><Input name="pack_size" value={form.pack_size} onChange={(e) => setForm({ ...form, pack_size: e.target.value })} /></Field>
        <Field label="Case pack"><Input name="case_pack" value={form.case_pack} onChange={(e) => setForm({ ...form, case_pack: e.target.value })} /></Field>
        <Field label="Avg weight (lb)"><Input name="avg_weight_lbs" value={String(form.avg_weight_lbs ?? "")} onChange={(e) => setForm({ ...form, avg_weight_lbs: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Wholesale price"><Input name="wholesale_price" value={String(form.wholesale_price ?? "")} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} /></Field>
        <Field label="Retail price"><Input name="retail_price" value={String(form.retail_price ?? "")} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} /></Field>
      </div>
      <Field label="QB income account override" hint="Blank = use category default from QB settings">
        <Input name="qb_income_account" value={form.qb_income_account} onChange={(e) => setForm({ ...form, qb_income_account: e.target.value })} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_b2b} onChange={(e) => setForm({ ...form, available_b2b: e.target.checked })} /> Available B2B</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_dtc} onChange={(e) => setForm({ ...form, available_dtc: e.target.checked })} /> Available DTC</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_this_week} onChange={(e) => setForm({ ...form, available_this_week: e.target.checked })} /> In stock this week</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
      </div>
      <label className="flex items-start gap-2 text-sm pt-1" title="Hidden from the catalog except for accounts you've added to its allow-list">
        <input type="checkbox" className="mt-0.5" checked={form.private} onChange={(e) => setForm({ ...form, private: e.target.checked })} />
        <span>
          <span className="font-medium">Private</span>
          <span className="text-ink-tertiary block text-xs">Only visible to accounts on this product&rsquo;s allow-list (manage from the account&rsquo;s page → Visible products).</span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button onClick={save} loading={saving}>Save</Button>
        {product ? <Button onClick={del} variant="danger">Delete</Button> : null}
      </div>
    </div>
  );
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Inline image control: shows the current product photo, lets the admin
 * click or drag-and-drop a new file to replace it. Uploads immediately
 * via the existing /api/admin/image-triage/apply endpoint (Supabase
 * Storage + image_url update + cache-bust). Independent of the Save
 * button — replacing the image is its own action, not part of the
 * form's other fields.
 */
function ProductImageEditor({ product }: { product: Product }) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product.image_url);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.push("Choose an image file (PNG, JPG, WebP)", "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.push("Image must be under 10MB", "error");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const previousUrl = previewUrl;
    setPreviewUrl(objectUrl);
    setUploading(true);
    const body = new FormData();
    body.set("image", file);
    body.set("product_id", product.id);
    const res = await fetch("/api/admin/image-triage/apply", { method: "POST", body });
    setUploading(false);
    URL.revokeObjectURL(objectUrl);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
      toast.push(error ?? "Upload failed", "error");
      setPreviewUrl(previousUrl);
      return;
    }
    const { image_url } = (await res.json()) as { image_url: string };
    setPreviewUrl(image_url);
    toast.push("Image replaced", "success");
    // Refresh the server component so the page header / surrounding UI
    // see the new image_url too (not just this form).
    router.refresh();
  }

  async function removeImage() {
    if (!previewUrl) return;
    if (!confirm("Remove this product's image? Buyers will see the placeholder.")) return;
    setUploading(true);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: null }),
    });
    setUploading(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Remove failed", "error");
      return;
    }
    setPreviewUrl(null);
    toast.push("Image removed", "success");
    router.refresh();
  }

  return (
    <Field label="Photo" hint="Click or drag-drop to replace. PNG, JPG, or WebP up to 10MB.">
      <div className="flex items-center gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
          className={`group relative h-32 w-32 shrink-0 rounded-md border overflow-hidden cursor-pointer transition ${
            dragOver
              ? "border-brand-blue bg-brand-blue-tint"
              : "border-dashed border-black/15 bg-bg-secondary hover:border-brand-blue/40"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-tertiary">
              No image
            </span>
          )}
          <span
            className={`absolute inset-0 flex items-center justify-center text-xs font-medium text-white bg-black/55 transition-opacity ${
              uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {uploading ? "Uploading…" : previewUrl ? "Replace" : "Add image"}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
            // reset so picking the same file again still fires onChange
            e.target.value = "";
          }}
        />
        {previewUrl && !uploading ? (
          <button
            type="button"
            onClick={removeImage}
            className="text-xs text-ink-tertiary hover:text-accent-rust transition"
          >
            Remove
          </button>
        ) : null}
      </div>
    </Field>
  );
}
