"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

/**
 * Self-service password setter on the account page. Uses Supabase's
 * own updateUser API — works on the current user's session, no admin
 * privileges required. After saving the user can sign in with email
 * + that password from /login → "Sign in with email instead".
 */
export function PasswordCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (pw.length < 8) {
      toast.push("Password must be at least 8 characters", "error");
      return;
    }
    if (pw !== confirm) {
      toast.push("Passwords don't match", "error");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      toast.push(error.message, "error");
      return;
    }
    toast.push("Password updated", "success");
    setPw("");
    setConfirm("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-between gap-3 px-1 py-2.5 rounded-md text-[15px] hover:bg-bg-secondary transition-colors duration-150 w-full text-left"
      >
        <span className="font-medium">Set or change password</span>
        <span className="text-ink-secondary text-[13px] flex items-center gap-1 shrink-0">
          <span aria-hidden className="text-ink-tertiary">›</span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3 px-1 py-2">
      <Field label="New password" hint="At least 8 characters">
        <Input
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="•••••••"
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="•••••••"
        />
      </Field>
      <div className="flex gap-2">
        <Button onClick={save} loading={loading} size="sm">
          Save password
        </Button>
        <Button
          onClick={() => {
            setOpen(false);
            setPw("");
            setConfirm("");
          }}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
      </div>
      <p className="text-[12px] text-ink-tertiary">
        Once set, sign in by tapping &ldquo;Sign in with email instead&rdquo;
        on the login page and entering your email + this password.
      </p>
    </div>
  );
}
