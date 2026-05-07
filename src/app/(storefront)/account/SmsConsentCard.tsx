"use client";

import { useState, useTransition } from "react";

interface Props {
  initialOptedIn: boolean;
  initialOptedInAt: string | null;
}

/**
 * Master SMS opt-in switch.
 *
 * When OFF, dispatch.ts blocks all transactional SMS to this profile
 * regardless of the per-type Notifications toggles below. When ON, the
 * granular toggles further refine which message types fire.
 *
 * Login codes (Twilio Verify) bypass dispatch entirely and are unaffected
 * by this toggle.
 */
export function SmsConsentCard({ initialOptedIn, initialOptedInAt }: Props) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [optedAt, setOptedAt] = useState<string | null>(initialOptedInAt);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    const next = !optedIn;
    setOptedIn(next);
    setErr(null);
    start(async () => {
      const res = await fetch("/api/auth/sms-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "account", opt_in: next }),
      });
      if (!res.ok) {
        setOptedIn(!next);
        setErr("Couldn't update — try again.");
        return;
      }
      setOptedAt(next ? new Date().toISOString() : null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium">Transactional SMS</div>
          <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
            Order confirmations, delivery updates, standing-order reminders,
            cutoff nudges. No marketing or promotional texts. Msg frequency
            varies (approx 1–20/month). Msg &amp; data rates may apply.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={optedIn}
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            optedIn ? "bg-brand-green" : "bg-ink-tertiary/40"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              optedIn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {optedIn ? (
        <p className="text-[11px] text-ink-tertiary">
          Opted in{optedAt ? ` on ${new Date(optedAt).toLocaleDateString()}` : ""}.
          Reply <strong>STOP</strong> to any text or flip this off to unsubscribe.
        </p>
      ) : (
        <p className="text-[11px] text-ink-tertiary">
          You&apos;ll only receive sign-in codes. The granular toggles below are
          ignored while this is off.
        </p>
      )}

      {err ? <p className="text-xs text-feedback-error">{err}</p> : null}
    </div>
  );
}
