"use client";

import { useState, useTransition } from "react";
import type { NotificationPrefs } from "@/lib/supabase/types";

const ROWS: { key: keyof NotificationPrefs; label: string; section: "push" | "email" | "sms" }[] = [
  { key: "push_order_tracking",      label: "Order tracking",      section: "push" },
  { key: "sms_cutoff_warning",       label: "Cutoff warnings",     section: "sms" },
  { key: "email_order_confirmation", label: "Order confirmation",  section: "email" },
  { key: "email_new_chat",           label: "New chat messages",   section: "email" },
  { key: "email_payments",           label: "Payments",            section: "email" },
];

const SECTION_LABELS: Record<"push" | "email" | "sms", string> = {
  push: "PUSH",
  sms: "SMS",
  email: "EMAIL",
};

const DEFAULTS: NotificationPrefs = {
  push_order_tracking: true,
  email_order_confirmation: true,
  email_new_chat: true,
  email_payments: false,
  sms_cutoff_warning: true,
};

export function NotificationToggles({ initial }: { initial: NotificationPrefs | null | undefined }) {
  // Migration 0007 backfills profile rows with defaults, but a buyer hitting
  // this page before the migration has been applied (or via a stale-shape
  // query) would otherwise crash on `prefs.<key>`. Fall back gracefully.
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => ({
    ...DEFAULTS,
    ...(initial ?? {}),
  }));
  const [, start] = useTransition();

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    start(async () => {
      const res = await fetch("/api/account/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) {
        // Revert on failure
        setPrefs(prefs);
      }
    });
  }

  const sections: ("push" | "sms" | "email")[] = ["push", "sms", "email"];
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section}>
          <div className="text-[10px] uppercase tracking-wide text-ink-tertiary mb-1">
            {SECTION_LABELS[section]}
          </div>
          <ul className="divide-y divide-black/5">
            {ROWS.filter((r) => r.section === section).map((r) => (
              <li key={r.key} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{r.label}</span>
                <button
                  role="switch"
                  aria-checked={prefs[r.key]}
                  onClick={() => toggle(r.key)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    prefs[r.key] ? "bg-brand-green" : "bg-ink-tertiary/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      prefs[r.key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
