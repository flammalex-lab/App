"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Row {
  name: string;
  phone?: string;
  email?: string;
  terms?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export function ImportClient() {
  const [raw, setRaw] = useState<Row[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFilename(file.name);
    const text = await file.text();
    setRaw(parseCSV(text));
    setResult(null);
  }

  async function submit() {
    if (!raw.length) return;
    setUploading(true);
    setResult(null);
    const res = await fetch("/api/admin/accounts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: raw }),
    });
    setUploading(false);
    if (!res.ok) { setResult((await res.json()).error ?? "Import failed"); return; }
    const { created, skipped } = await res.json();
    setResult(`Created ${created}, skipped ${skipped} (already existed).`);
  }

  const preview = useMemo(() => raw.slice(0, 20), [raw]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {filename ? <p className="text-xs text-ink-secondary mt-2">{filename} — {raw.length} rows parsed</p> : null}
      </div>

      {preview.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-ink-secondary">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Terms</th>
                <th className="p-2">City</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.phone}</td>
                  <td className="p-2">{r.email}</td>
                  <td className="p-2">{r.terms}</td>
                  <td className="p-2">{r.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {raw.length > preview.length ? (
            <div className="p-2 text-xs text-ink-secondary">… {raw.length - preview.length} more rows</div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!raw.length} loading={uploading}>Import</Button>
        {result ? <p className="text-sm">{result}</p> : null}
      </div>

      <details className="text-xs text-ink-secondary">
        <summary>Expected column headers</summary>
        <p className="mt-1">
          Name, Phone, Main Phone, Email, Main Email, Terms, Bill Address 1, Bill City, Bill State, Bill Zip.
          The importer does its best match on common QuickBooks export field names.
        </p>
      </details>
    </div>
  );
}

function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const h = {
    name: idx(["customer", "name"]),
    phone: idx(["phone", "mobile"]),
    email: idx(["email"]),
    terms: idx(["terms"]),
    addressLine1: idx(["bill address 1", "billing address", "address 1", "address line 1"]),
    city: idx(["city"]),
    state: idx(["state"]),
    zip: idx(["zip", "postal"]),
  };
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const name = cells[h.name]?.trim();
    if (!name) continue;
    out.push({
      name,
      phone: cells[h.phone]?.trim(),
      email: cells[h.email]?.trim(),
      terms: cells[h.terms]?.trim(),
      addressLine1: cells[h.addressLine1]?.trim(),
      city: cells[h.city]?.trim(),
      state: cells[h.state]?.trim(),
      zip: cells[h.zip]?.trim(),
    });
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
