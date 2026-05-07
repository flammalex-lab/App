"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { normalizePhone } from "@/lib/utils/phone";

export function LoginClient() {
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <>
      {showAdmin ? <AdminPasswordForm onBack={() => setShowAdmin(false)} /> : <PhoneOtpForm />}
      {!showAdmin ? (
        <div className="text-center mt-5">
          <button
            onClick={() => setShowAdmin(true)}
            className="text-xs text-ink-tertiary hover:text-ink-secondary underline"
          >
            Sign in with email instead
          </button>
        </div>
      ) : null}
    </>
  );
}

function PhoneOtpForm() {
  const supabase = createClient();
  const nextParam = useSearchParams().get("next");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  async function sendCode() {
    setErr(null);
    const e164 = normalizePhone(phone);
    if (!e164) { setErr("Enter a valid US phone number."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms" } });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setStep("otp");
  }

  async function verify() {
    setErr(null);
    const e164 = normalizePhone(phone);
    if (!e164) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error) { setLoading(false); setErr(error.message); return; }

    if (smsConsent) {
      // Best-effort consent stamp — failure here doesn't block sign-in.
      try {
        await fetch("/api/auth/sms-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "login" }),
        });
      } catch {
        // ignore
      }
    }

    setLoading(false);
    window.location.assign(nextParam || "/guide");
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg text-center">Sign in with your phone</h2>
      {step === "phone" ? (
        <>
          <Field label="Phone number" hint="We'll text you a 6-digit code">
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              className="text-center text-lg py-3"
            />
          </Field>
          <p className="text-xs text-ink-secondary leading-relaxed">
            We'll text you a one-time sign-in code (Twilio Verify). Msg
            &amp; data rates may apply. See our{" "}
            <Link href="/privacy" className="underline hover:text-ink-primary">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline hover:text-ink-primary">
              Terms
            </Link>
            .
          </p>
          <label className="flex items-start gap-2.5 text-xs text-ink-secondary leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue"
            />
            <span>
              <strong className="text-ink-primary">Optional:</strong> Also
              send me transactional SMS from Fingerlakes Farms — order
              confirmations, delivery updates, standing-order reminders. No
              marketing or promotional texts. Msg frequency varies (approx
              1–20/month). Reply <strong>STOP</strong> to opt out,{" "}
              <strong>HELP</strong> for help. You can sign in without
              checking this box — you'll receive sign-in codes only.
            </span>
          </label>
          <Button onClick={sendCode} loading={loading} className="w-full" size="lg">
            Text me a code
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-secondary text-center">
            We sent a 6-digit code to <strong>{phone}</strong>
          </p>
          <Field label="Enter code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              className="text-center text-2xl tracking-[0.3em] py-3 mono"
            />
          </Field>
          <Button onClick={verify} loading={loading} className="w-full" size="lg">
            Sign in
          </Button>
          <button type="button" onClick={() => setStep("phone")} className="text-sm text-ink-secondary underline block mx-auto">
            Change number
          </button>
        </>
      )}
      {err ? <p className="text-sm text-feedback-error text-center">{err}</p> : null}
    </div>
  );
}

function AdminPasswordForm({ onBack }: { onBack: () => void }) {
  const nextParam = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setErr(error.message); return; }

    // Route by role so a tester with a b2b_buyer profile lands directly
    // on /guide instead of bouncing through /dashboard's admin redirect.
    let dest = nextParam || "/guide";
    if (!nextParam && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      dest = role === "admin" ? "/dashboard" : role === "dtc_customer" ? "/catalog" : "/guide";
    }
    setLoading(false);
    window.location.assign(dest);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Sign in with email</h2>
        <button onClick={onBack} className="text-sm text-ink-secondary underline">
          Back to phone
        </button>
      </div>
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Button onClick={submit} loading={loading} className="w-full" size="lg">Sign in</Button>
      {err ? <p className="text-sm text-feedback-error text-center">{err}</p> : null}
    </div>
  );
}
