"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface Match {
  id: string;
  sku: string | null;
  name: string;
  producer: string | null;
  pack_size: string | null;
  unit: string;
}

interface MatchResult {
  match: Match | null;
  source: "filename_sku" | "vision" | "no_candidates" | "no_vision_response" | "parse_error";
  confidence?: "high" | "medium" | "low" | "none";
  reasoning?: string;
  candidates?: { id: string; name: string; producer: string | null; pack_size: string | null }[];
}

type ItemStatus =
  | "idle"
  | "stripping"
  | "stripped"
  | "matching"
  | "matched"
  | "applying"
  | "applied"
  | "error"
  | "skipped";

interface Item {
  id: string;
  file: File; // original
  cutoutFile: File | null; // background-removed
  previewUrl: string;
  status: ItemStatus;
  result?: MatchResult;
  chosenProductId?: string | null;
  error?: string;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function ImageTriageClient() {
  const toast = useToast();
  const [producer, setProducer] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [stripBg, setStripBg] = useState(true);

  const counts = useMemo(() => {
    const c = { total: items.length, matched: 0, applied: 0, needsReview: 0, skipped: 0, errors: 0 };
    for (const it of items) {
      if (it.status === "applied") c.applied += 1;
      else if (it.status === "matched" && it.result?.match) c.matched += 1;
      else if (it.status === "matched" && !it.result?.match) c.needsReview += 1;
      else if (it.status === "skipped") c.skipped += 1;
      else if (it.status === "error") c.errors += 1;
    }
    return c;
  }, [items]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: Item[] = [];
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({
        id: crypto.randomUUID(),
        file: f,
        cutoutFile: null,
        previewUrl: URL.createObjectURL(f),
        status: "idle",
      });
    }
    setItems((xs) => [...xs, ...next]);
  }

  /**
   * Server-side background removal via Replicate (rembg / BRIA RMBG).
   * Returns a transparent PNG blob.
   */
  async function stripBackground(file: File): Promise<File> {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/admin/image-triage/strip-bg", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "strip-bg failed" }));
      throw new Error(err.error ?? `strip-bg ${res.status}`);
    }
    const blob = await res.blob();
    const pngName = file.name.replace(/\.[^.]+$/, "") + ".png";
    return new File([blob], pngName, { type: "image/png" });
  }

  async function processAll() {
    setRunning(true);
    for (const it of items) {
      if (it.status !== "idle") continue;

      let working: File = it.file;
      if (stripBg) {
        setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: "stripping" } : x)));
        try {
          const cutout = await stripBackground(it.file);
          const cutoutUrl = URL.createObjectURL(cutout);
          working = cutout;
          setItems((xs) =>
            xs.map((x) =>
              x.id === it.id
                ? { ...x, cutoutFile: cutout, previewUrl: cutoutUrl, status: "stripped" }
                : x,
            ),
          );
        } catch (e: any) {
          setItems((xs) =>
            xs.map((x) =>
              x.id === it.id
                ? { ...x, status: "error", error: `bg removal failed: ${e?.message ?? "unknown"}` }
                : x,
            ),
          );
          continue;
        }
      }

      setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: "matching" } : x)));
      try {
        const imageBase64 = await readAsBase64(working);
        const res = await fetch("/api/admin/image-triage/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: it.file.name,
            producer: producer.trim() || null,
            imageBase64,
            imageMediaType: working.type || "image/jpeg",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "match failed" }));
          setItems((xs) =>
            xs.map((x) =>
              x.id === it.id ? { ...x, status: "error", error: err.error ?? "match failed" } : x,
            ),
          );
          continue;
        }
        const result = (await res.json()) as MatchResult;
        setItems((xs) =>
          xs.map((x) =>
            x.id === it.id
              ? {
                  ...x,
                  status: "matched",
                  result,
                  chosenProductId: result.match?.id ?? null,
                }
              : x,
          ),
        );
      } catch (e: any) {
        setItems((xs) =>
          xs.map((x) =>
            x.id === it.id ? { ...x, status: "error", error: e?.message ?? "match failed" } : x,
          ),
        );
      }
    }
    setRunning(false);
  }

  async function confirm(itemId: string) {
    const it = items.find((x) => x.id === itemId);
    if (!it || !it.chosenProductId) return;
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, status: "applying" } : x)));
    const form = new FormData();
    // Upload the cutout if we have one, else the original.
    form.append("image", it.cutoutFile ?? it.file);
    form.append("product_id", it.chosenProductId);
    const res = await fetch("/api/admin/image-triage/apply", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "apply failed" }));
      setItems((xs) =>
        xs.map((x) =>
          x.id === itemId ? { ...x, status: "error", error: err.error ?? "apply failed" } : x,
        ),
      );
      toast.push(err.error ?? "Apply failed", "error");
      return;
    }
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, status: "applied" } : x)));
    toast.push(`Saved image for ${it.result?.match?.name ?? "product"}`, "success");
  }

  function skip(itemId: string) {
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, status: "skipped" } : x)));
  }

  function chooseProduct(itemId: string, productId: string) {
    setItems((xs) =>
      xs.map((x) => (x.id === itemId ? { ...x, chosenProductId: productId } : x)),
    );
  }

  async function applyAllHighConfidence() {
    const ready = items.filter(
      (it) =>
        it.status === "matched" &&
        it.chosenProductId &&
        (it.result?.source === "filename_sku" || it.result?.confidence === "high"),
    );
    for (const it of ready) {
      await confirm(it.id);
    }
  }

  const pendingCount = items.filter((x) => x.status === "idle").length;

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <Field label="Producer hint (optional)" hint="Scopes the AI match to products from this producer. Leave blank to match against the whole catalog.">
          <Input
            value={producer}
            onChange={(e) => setProducer(e.target.value)}
            placeholder="Olivia's, Satur Farms, Barrel Brine…"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={stripBg}
            onChange={(e) => setStripBg(e.target.checked)}
          />
          <span>
            <strong>Strip background</strong> (Replicate rembg · ~5–10s per image · a few tenths
            of a cent each)
          </span>
        </label>
        <div>
          <label className="label">Images</label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="text-sm"
            />
            <Button onClick={processAll} loading={running} disabled={items.length === 0 || running}>
              Process {pendingCount || ""} pending
            </Button>
            <Button
              variant="secondary"
              onClick={applyAllHighConfidence}
              disabled={
                running ||
                items.filter(
                  (x) =>
                    x.status === "matched" &&
                    (x.result?.source === "filename_sku" || x.result?.confidence === "high"),
                ).length === 0
              }
            >
              Apply all high-confidence
            </Button>
          </div>
          <p className="text-xs text-ink-tertiary mt-2">
            Drop a folder or multi-select. Filenames containing a product SKU are auto-matched
            with zero AI cost; everything else is sent to Claude with the producer hint.
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-4 text-xs text-ink-secondary">
          <span>
            <span className="tabular font-semibold text-ink-primary">{counts.total}</span> total
          </span>
          <span>
            <span className="tabular font-semibold text-brand-green-dark">{counts.applied}</span>{" "}
            applied
          </span>
          <span>
            <span className="tabular font-semibold">{counts.matched}</span> awaiting confirm
          </span>
          <span>
            <span className="tabular font-semibold text-accent-rust">{counts.needsReview}</span>{" "}
            need review
          </span>
          {counts.skipped > 0 ? (
            <span>
              <span className="tabular font-semibold">{counts.skipped}</span> skipped
            </span>
          ) : null}
          {counts.errors > 0 ? (
            <span className="text-feedback-error">
              <span className="tabular font-semibold">{counts.errors}</span> errors
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            onConfirm={() => confirm(it.id)}
            onSkip={() => skip(it.id)}
            onChooseProduct={(pid) => chooseProduct(it.id, pid)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onConfirm,
  onSkip,
  onChooseProduct,
}: {
  item: Item;
  onConfirm: () => void;
  onSkip: () => void;
  onChooseProduct: (id: string) => void;
}) {
  const r = item.result;
  const match = r?.match ?? null;
  const confidenceLabel =
    r?.source === "filename_sku" ? "filename SKU" : r?.confidence ?? null;
  const confidenceColor =
    r?.source === "filename_sku"
      ? "badge-green"
      : r?.confidence === "high"
      ? "badge-green"
      : r?.confidence === "medium"
      ? "badge-gold"
      : r?.confidence === "low"
      ? "badge-rust"
      : "badge-gray";

  return (
    <div className="card p-3 flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt=""
        className="h-24 w-24 object-contain bg-bg-secondary rounded-md shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-ink-tertiary truncate">{item.file.name}</div>
        {item.status === "stripping" ? (
          <div className="text-sm text-ink-secondary italic mt-2">Removing background…</div>
        ) : null}
        {item.status === "stripped" ? (
          <div className="text-sm text-ink-secondary italic mt-2">Background removed · matching…</div>
        ) : null}
        {item.status === "matching" ? (
          <div className="text-sm text-ink-secondary italic mt-2">Matching…</div>
        ) : null}
        {item.status === "idle" ? (
          <div className="text-sm text-ink-tertiary mt-2">Queued — click Process above.</div>
        ) : null}
        {item.status === "applied" ? (
          <div className="text-sm text-brand-green-dark mt-2">
            ✓ Saved — {match?.name}
          </div>
        ) : null}
        {item.status === "skipped" ? (
          <div className="text-sm text-ink-tertiary mt-2">Skipped.</div>
        ) : null}
        {item.status === "error" ? (
          <div className="text-sm text-feedback-error mt-2">{item.error}</div>
        ) : null}
        {(item.status === "matched" || item.status === "applying") && r ? (
          <div className="space-y-2 mt-1">
            {match ? (
              <>
                <div className="text-sm font-medium">{match.name}</div>
                <div className="text-xs text-ink-secondary">
                  {match.producer ?? "—"} · {match.pack_size ?? match.unit} ·{" "}
                  {match.sku ? <span className="tabular">{match.sku}</span> : "no SKU"}
                </div>
                {confidenceLabel ? (
                  <span className={confidenceColor}>{confidenceLabel}</span>
                ) : null}
                {r.reasoning ? (
                  <div className="text-[11px] text-ink-tertiary italic">{r.reasoning}</div>
                ) : null}
                {item.cutoutFile ? (
                  <div className="text-[11px] text-ink-tertiary">
                    Uploading cutout ({Math.round(item.cutoutFile.size / 1024)} KB)
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-feedback-error">
                No match.{" "}
                {r.source === "no_candidates"
                  ? "No products in that producer."
                  : r.reasoning ?? "Claude couldn't place this image."}
              </div>
            )}
            {r.candidates && r.candidates.length > 0 ? (
              <select
                className="input text-xs"
                value={item.chosenProductId ?? ""}
                onChange={(e) => onChooseProduct(e.target.value)}
              >
                <option value="">— pick a product —</option>
                {r.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.pack_size ? ` · ${c.pack_size}` : ""}
                    {c.producer ? ` · ${c.producer}` : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={onConfirm}
                loading={item.status === "applying"}
                disabled={!item.chosenProductId}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
