"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { CATEGORY_LABELS, BRAND_LABELS } from "@/lib/constants";

type Status = "idle" | "uploading" | "done" | "error";
interface RowState {
  status: Status;
  error?: string;
  uploadedUrl?: string;
}

type WithoutImagesProduct = Pick<
  Product,
  "id" | "sku" | "name" | "producer" | "pack_size" | "unit" | "brand" | "category" | "image_url" | "sort_order"
>;

export function WithoutImagesClient({ products }: { products: WithoutImagesProduct[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, RowState>>({});
  const [stripBg, setStripBg] = useState(false);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);

  async function uploadFor(productId: string, file: File) {
    setState((s) => ({ ...s, [productId]: { status: "uploading" } }));
    try {
      let working = file;
      if (stripBg) {
        const bgForm = new FormData();
        bgForm.append("image", file);
        const start = await fetch("/api/admin/image-triage/strip-bg", {
          method: "POST",
          body: bgForm,
        });
        if (!start.ok) {
          const body = await start.json().catch(() => ({}));
          throw new Error(body.error ?? `strip-bg start ${start.status}`);
        }
        const { id } = (await start.json()) as { id: string };
        // Poll status — same pattern the triage page uses, capped at ~30s.
        const cutoutBlob = await pollCutout(id);
        if (cutoutBlob) {
          working = new File([cutoutBlob], `${productId}.png`, { type: "image/png" });
        }
        // If strip-bg failed silently, fall through with the original file.
      }

      const form = new FormData();
      form.append("image", working);
      form.append("product_id", productId);
      const res = await fetch("/api/admin/image-triage/apply", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `apply ${res.status}`);
      }
      const { image_url } = (await res.json()) as { image_url: string };
      setState((s) => ({
        ...s,
        [productId]: { status: "done", uploadedUrl: image_url },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        [productId]: { status: "error", error: msg },
      }));
    }
  }

  function onDrop(productId: string) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActiveDropId(null);
      const f = Array.from(e.dataTransfer.files).find((x) =>
        x.type.startsWith("image/"),
      );
      if (f) uploadFor(productId, f);
    };
  }

  function onPick(productId: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && f.type.startsWith("image/")) uploadFor(productId, f);
    };
  }

  // Hide cards that finished uploading — admin's looking at "what's left".
  // Add a "Refresh" CTA after the first upload so you can re-fetch the
  // server list without losing in-flight work.
  const visible = products.filter((p) => state[p.id]?.status !== "done");
  const doneCount = Object.values(state).filter((s) => s.status === "done").length;

  return (
    <>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={stripBg}
            onChange={(e) => setStripBg(e.target.checked)}
          />
          Strip background on upload (slower; ~5–10s per image)
        </label>
        {doneCount > 0 ? (
          <button
            onClick={() => router.refresh()}
            className="text-sm underline"
          >
            Refresh list ({doneCount} uploaded)
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-secondary">
          {products.length === 0
            ? "Nothing missing an image here. ✓"
            : `All ${products.length} cards uploaded. Refresh to see what's left across the catalog.`}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => {
            const st = state[p.id] ?? { status: "idle" as Status };
            return (
              <div
                key={p.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setActiveDropId(p.id);
                }}
                onDragLeave={() =>
                  setActiveDropId((c) => (c === p.id ? null : c))
                }
                onDrop={onDrop(p.id)}
                className={`card p-3 flex flex-col gap-2 transition ${
                  activeDropId === p.id
                    ? "border-brand-blue bg-brand-blue-tint/40"
                    : ""
                }`}
              >
                <div className="aspect-square rounded-md border-2 border-dashed border-black/15 bg-bg-secondary/40 flex items-center justify-center text-center px-2">
                  {st.status === "uploading" ? (
                    <span className="text-xs text-ink-secondary animate-pulse">
                      Uploading…
                    </span>
                  ) : st.status === "error" ? (
                    <span className="text-xs text-feedback-error px-2">
                      {st.error ?? "Upload failed"}
                    </span>
                  ) : (
                    <label className="cursor-pointer text-xs text-ink-tertiary px-2">
                      <span className="block mb-1">Drop image here</span>
                      <span className="underline text-brand-blue">or pick a file</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onPick(p.id)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium leading-snug truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-ink-secondary truncate">
                    {p.producer ?? "—"}
                  </div>
                  <div className="text-[10px] text-ink-tertiary mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
                    {p.sku ? <span className="tabular">{p.sku}</span> : null}
                    {p.pack_size ? <span>· {p.pack_size}</span> : null}
                    <span>· {CATEGORY_LABELS[p.category]}</span>
                    <span>· {BRAND_LABELS[p.brand]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

async function pollCutout(predictionId: string): Promise<Blob | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`/api/admin/image-triage/strip-bg/status?id=${predictionId}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { status: string; output_url?: string };
    if (body.status === "succeeded" && body.output_url) {
      const imgRes = await fetch(body.output_url);
      if (!imgRes.ok) return null;
      return await imgRes.blob();
    }
    if (body.status === "failed" || body.status === "canceled") return null;
  }
  return null;
}
