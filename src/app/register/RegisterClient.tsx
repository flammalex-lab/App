"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { normalizePhone } from "@/lib/utils/phone";

export function RegisterClient() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({ first: "", last: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(null);
    const phone = normalizePhone(form.phone);
    if (!phone) { setErr("Enter a valid US phone number."); return; }
    if (form.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first,
          last_name: form.last,
          phone,
          role: "dtc_customer",
        },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push("/catalog");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><Input value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} /></Field>
        <Field label="Last name"><Input value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} /></Field>
      </div>
      <Field label="Email">
        <Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Phone">
        <Input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>
      <p className="text-xs text-ink-secondary leading-relaxed">
        By creating an account, you agree to receive transactional SMS
        from Fingerlakes Farms — login verification codes and order /
        delivery updates only. We do not send marketing or promotional
        texts. Msg &amp; data rates may apply. Msg frequency varies.
        Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for
        help. See our{" "}
        <Link href="/privacy" className="underline hover:text-ink-primary">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline hover:text-ink-primary">
          Terms
        </Link>
        .
      </p>
      <Button onClick={submit} loading={loading} className="w-full">Create account</Button>
      {err ? <p className="text-sm text-feedback-error">{err}</p> : null}
      <p className="text-sm text-ink-secondary text-center">
        Already have an account? <Link className="underline" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
