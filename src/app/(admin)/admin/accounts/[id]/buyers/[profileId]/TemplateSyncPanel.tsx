"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export interface TemplateLite {
  id: string;
  name: string;
  buyer_type: string | null;
  itemCount: number;
}

export interface DriftStats {
  addedByBuyer: number;
  removedFromTemplates: number;
  pendingSync: number;
}

export function TemplateSyncPanel({
  profileId,
  sourceTemplates,
  availableTemplates,
  drift,
}: {
  profileId: string;
  sourceTemplates: TemplateLite[];
  availableTemplates: TemplateLite[];
  drift: DriftStats;
}) {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [savingSources, setSavingSources] = useState(false);

  async function sync() {
    setSyncing(true);
    const res = await fetch(`/api/admin/buyers/${profileId}/sync-from-template`, {
      method: "POST",
    });
    setSyncing(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Sync failed", "error");
      return;
    }
    const { added } = (await res.json()) as { added: number };
    toast.push(
      added > 0 ? `Added ${added} items from templates` : "Guide already in sync with templates",
      "success",
    );
    router.refresh();
  }

  async function addSources() {
    if (selected.length === 0) {
      setPicking(false);
      return;
    }
    setSavingSources(true);
    const res = await fetch(`/api/admin/buyers/${profileId}/seed-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_ids: selected, seed_now: true }),
    });
    setSavingSources(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Failed to attach templates", "error");
      return;
    }
    const { seeded } = (await res.json()) as { seeded: number };
    toast.push(
      seeded > 0 ? `Attached + seeded ${seeded} items` : "Templates attached (no new items)",
      "success",
    );
    setPicking(false);
    setSelected([]);
    router.refresh();
  }

  async function removeSource(templateId: string) {
    if (!confirm("Detach this template from the buyer's guide? Items stay.")) return;
    const res = await fetch(
      `/api/admin/buyers/${profileId}/seed-sources?template_id=${templateId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Detach failed", "error");
      return;
    }
    toast.push("Template detached", "success");
    router.refresh();
  }

  const sourceIds = new Set(sourceTemplates.map((t) => t.id));
  const pickable = availableTemplates.filter((t) => !sourceIds.has(t.id));

  return (
    <div className="card p-4 space-y-3">
      {/* Sources */}
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Seed templates</h3>
          <Link
            href="/admin/order-guides/templates"
            className="text-xs text-brand-blue hover:underline"
          >
            Manage templates →
          </Link>
        </div>
        {sourceTemplates.length === 0 ? (
          <p className="text-xs text-ink-secondary mt-1">
            None attached. Pick one or more to define the buyer&rsquo;s starter list.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sourceTemplates.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-black/10 bg-bg-secondary text-xs"
              >
                {t.name}
                <span className="tabular text-ink-tertiary">{t.itemCount}</span>
                <button
                  onClick={() => removeSource(t.id)}
                  className="h-5 w-5 rounded-full hover:bg-white/80 flex items-center justify-center text-ink-tertiary hover:text-feedback-error"
                  aria-label="Detach"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Drift */}
      {sourceTemplates.length > 0 ? (
        <div className="text-xs text-ink-secondary pt-1 border-t border-black/5">
          <span className="mr-3">
            <span className="tabular font-medium text-brand-green-dark">
              +{drift.addedByBuyer}
            </span>{" "}
            added by buyer
          </span>
          <span className="mr-3">
            <span className="tabular font-medium text-feedback-error">
              −{drift.removedFromTemplates}
            </span>{" "}
            removed
          </span>
          <span>
            <span className="tabular font-medium text-ink-primary">{drift.pendingSync}</span>{" "}
            pending sync
          </span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {sourceTemplates.length > 0 ? (
          <Button
            size="sm"
            loading={syncing}
            onClick={sync}
            disabled={drift.pendingSync === 0}
          >
            {drift.pendingSync > 0 ? `Sync ${drift.pendingSync} new items` : "In sync"}
          </Button>
        ) : null}
        {!picking ? (
          <Button
            variant={sourceTemplates.length === 0 ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPicking(true)}
            disabled={pickable.length === 0}
          >
            {sourceTemplates.length === 0 ? "Attach templates" : "Add another template"}
          </Button>
        ) : (
          <div className="flex-1">
            <div className="text-xs text-ink-secondary mb-2">
              Pick template(s) to attach. Clicking <strong>Attach</strong> will also seed any
              missing items into the guide (tombstones still respected).
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pickable.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelected((xs) =>
                        xs.includes(t.id) ? xs.filter((x) => x !== t.id) : [...xs, t.id],
                      )
                    }
                    className={`px-3 py-1 rounded-full border text-xs transition ${
                      on
                        ? "bg-brand-blue text-white border-brand-blue"
                        : "bg-white text-ink-primary border-black/10 hover:bg-bg-secondary"
                    }`}
                  >
                    {t.name}{" "}
                    <span className={`tabular ${on ? "opacity-80" : "text-ink-tertiary"}`}>
                      {t.itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSources} loading={savingSources} disabled={selected.length === 0}>
                Attach {selected.length || ""}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPicking(false);
                  setSelected([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
