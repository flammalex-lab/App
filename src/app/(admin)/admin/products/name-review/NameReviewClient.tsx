"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Row {
  id: string;
  sku?: string;
  name?: string;
  pack_size?: string | null;
  needs_naming_review?: boolean;
}

export function NameReviewClient({ pendingCount }: { pendingCount: number }) {
  const [raw, setRaw] = useState<Row[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    errors?: Array<{ id: string; reason: string }>;
  } | null>(null);
  const toast = useToast();

  async function handleFile(file: File) {
    setFilename(file.name);
    const text = await file.text();
    setRaw(parseCSV(text));
    setResult(null);
  }

  async function submit() {
    if (!raw.length) return;
    setUploading(true);
    const res = await fetch("/api/admin/products/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: raw }),
    });
    setUploading(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Import failed", "error");
      return;
    }
    const summary = await res.json();
    setResult(summary);
    toast.push(`Updated ${summary.updated}, skipped ${summary.skipped}`, "success");
  }

  const preview = useMemo(() => raw.slice(0, 20), [raw]);
  const flippedCount = useMemo(
    () => raw.filter((r) => r.needs_naming_review === false).length,
    [raw],
  );

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm">
            <strong className="tabular">{pendingCount}</strong> item{pendingCount === 1 ? "" : "s"} pending review.
          </span>
          <a
            href="/api/admin/products/export-csv"
            className="btn-primary text-sm"
            download
          >
            Export pending CSV
          </a>
          <a
            href="/api/admin/products/export-csv?all=1"
            className="text-sm underline text-ink-secondary"
            download
          >
            Export all active
          </a>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium mb-2">Re-upload edited CSV</p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {filename ? (
          <p className="text-xs text-ink-secondary mt-2">
            {filename} — {raw.length} row{raw.length === 1 ? "" : "s"} parsed
            {flippedCount > 0 ? <> · {flippedCount} marked finalized</> : null}
          </p>
        ) : null}
      </div>

      {preview.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-ink-secondary">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Name</th>
                <th className="p-2">Pack size</th>
                <th className="p-2">Finalized?</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  <td className="p-2 mono">{r.sku ?? ""}</td>
                  <td className="p-2">{r.name ?? ""}</td>
                  <td className="p-2">{r.pack_size ?? ""}</td>
                  <td className="p-2">
                    {r.needs_naming_review === false ? (
                      <span className="badge-green">yes</span>
                    ) : (
                      <span className="badge-gray">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {raw.length > preview.length ? (
            <div className="p-2 text-xs text-ink-secondary">
              … {raw.length - preview.length} more row{raw.length - preview.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!raw.length} loading={uploading}>
          Apply changes
        </Button>
        {result ? (
          <p className="text-sm">
            ✓ {result.updated} updated, {result.skipped} skipped
          </p>
        ) : null}
      </div>

      {result?.errors && result.errors.length > 0 ? (
        <div className="card p-3 text-xs">
          <p className="font-medium text-accent-rust mb-1">
            First {result.errors.length} skip reason{result.errors.length === 1 ? "" : "s"}:
          </p>
          <ul className="space-y-0.5 text-ink-secondary">
            {result.errors.map((e, i) => (
              <li key={i}>
                <span className="mono font-medium text-ink-primary">{e.id}</span>: {e.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (key: string) => headers.indexOf(key);
  const i = {
    id: idx("id"),
    sku: idx("sku"),
    name: idx("name"),
    pack_size: idx("pack_size"),
    needs_naming_review: idx("needs_naming_review"),
  };
  if (i.id < 0) return [];

  const out: Row[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCSVLine(lines[r]);
    const id = cells[i.id]?.trim();
    if (!id) continue;
    const row: Row = { id };
    if (i.sku >= 0) row.sku = cells[i.sku]?.trim() || undefined;
    if (i.name >= 0) row.name = cells[i.name]?.trim() || undefined;
    if (i.pack_size >= 0) {
      const v = cells[i.pack_size]?.trim();
      row.pack_size = v ? v : null;
    }
    if (i.needs_naming_review >= 0) {
      const v = cells[i.needs_naming_review]?.trim().toLowerCase();
      // Spreadsheet apps export booleans as "true"/"false" or "TRUE"/"FALSE";
      // Excel sometimes writes 1/0. Anything else → leave the flag alone.
      if (v === "true" || v === "1") row.needs_naming_review = true;
      else if (v === "false" || v === "0") row.needs_naming_review = false;
    }
    out.push(row);
  }
  return out;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
