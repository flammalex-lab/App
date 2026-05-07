"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export function RegisterClient() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    accountName: "",
    role: "",
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, smsConsent }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Something went wrong." }));
      setErr(error || "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <h2 className="display text-xl">Thanks!</h2>
        <p className="text-sm text-ink-secondary">A rep will be in touch shortly.</p>
        <Link href="/" className="text-sm underline text-ink-secondary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Phone">
        <Input
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </Field>
      <Field label="Account name">
        <Input
          autoComplete="organization"
          value={form.accountName}
          onChange={(e) => setForm({ ...form, accountName: e.target.value })}
        />
      </Field>
      <Field label="Role">
        <Input
          placeholder="Chef, GM, Buyer, etc."
          autoComplete="organization-title"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
      </Field>

      <label className="flex items-start gap-2.5 text-xs text-ink-secondary leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={smsConsent}
          onChange={(e) => setSmsConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue"
        />
        <span>
          I agree to receive transactional SMS from Fingerlakes Farms (order
          confirmations, delivery updates, standing-order reminders) at the
          phone number above. We do not send marketing or promotional texts.
          Msg &amp; data rates may apply. Msg frequency varies (approx
          1–20/month). Reply <strong>STOP</strong> to opt out,{" "}
          <strong>HELP</strong> for help. See our{" "}
          <Link href="/privacy" className="underline hover:text-ink-primary">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline hover:text-ink-primary">
            Terms
          </Link>
          .
        </span>
      </label>

      <Button onClick={submit} loading={loading} className="w-full">
        Create account
      </Button>
      {err ? <p className="text-sm text-feedback-error">{err}</p> : null}
      <p className="text-sm text-ink-secondary text-center">
        A rep will be in touch shortly.
      </p>
      <p className="text-sm text-ink-secondary text-center">
        Already have an account?{" "}
        <Link className="underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
