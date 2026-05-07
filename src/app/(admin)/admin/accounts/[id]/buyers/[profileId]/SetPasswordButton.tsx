"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

/**
 * Sets a new password directly on the auth.users row for this buyer.
 * Bypasses the recovery-email flow which routinely fails (expired
 * tokens, link prefetched by mail clients, etc.). Useful for tester
 * accounts and emergency fixes.
 */
export function SetPasswordButton({ profileId }: { profileId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (pw.length < 8) {
      toast.push("Password must be at least 8 characters", "error");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, password: pw }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "unknown" }));
      toast.push(error ?? "Failed to set password", "error");
      return;
    }
    toast.push("Password updated", "success");
    setPw("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary" size="sm">
        Set password
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Field label="New password" hint="Minimum 8 characters">
        <Input
          type="text"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Type a new password"
        />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} loading={loading} size="sm">
          Save password
        </Button>
        <Button
          onClick={() => {
            setOpen(false);
            setPw("");
          }}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-ink-tertiary">
        The buyer can sign in immediately with this password via the
        &ldquo;Sign in with email&rdquo; link on /login. Tell them out-of-band
        — this dialog won&rsquo;t store or remember the password.
      </p>
    </div>
  );
}
