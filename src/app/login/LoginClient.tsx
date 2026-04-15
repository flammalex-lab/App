"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { normalizePhone } from "@/lib/utils/phone";
import { signInWithPasswordAction } from "./actions";

type Mode = "phone" | "admin";

export function LoginClient() {
  const [mode, setMode] = useState<Mode>("phone");
  return (
    <>
      <div className="flex text-sm border-b border-black/10 mb-4">
        <TabBtn active={mode === "phone"} onClick={() => setMode("phone")}>Buyer — phone</TabBtn>
        <TabBtn active={mode === "admin"} onClick={() => setMode("admin")}>Admin — email</TabBtn>
      </div>
      {mode === "phone" ? <PhoneOtpForm /> : <AdminPasswordForm />}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 border-b-2 ${active ? "border-brand-green text-brand-green" : "border-transparent text-ink-secondary"}`}
    >
      {children}
    </button>
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
    setLoading(false);
    if (error) { setErr(error.message); return; }
    window.location.assign(nextParam || "/guide");
  }

  return (
    <div className="space-y-4">
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
            />
          </Field>
          <Button onClick={sendCode} loading={loading} className="w-full">Text me a code</Button>
        </>
      ) : (
        <>
          <Field label="Enter the 6-digit code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
          </Field>
          <Button onClick={verify} loading={loading} className="w-full">Sign in</Button>
          <button type="button" onClick={() => setStep("phone")} className="text-sm text-ink-secondary underline">
            Change number
          </button>
        </>
      )}
      {err ? <p className="text-sm text-feedback-error">{err}</p> : null}
    </div>
  );
}

function AdminPasswordForm() {
  const nextParam = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(null);
    setLoading(true);
    const result = await signInWithPasswordAction(email, password, nextParam);
    setLoading(false);
    if (result?.error) { setErr(result.error); return; }
  }

  return (
    <div className="space-y-4">
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Button onClick={submit} loading={loading} className="w-full">Sign in</Button>
      {err ? <p className="text-sm text-feedback-error">{err}</p> : null}
    </div>
  );
}
