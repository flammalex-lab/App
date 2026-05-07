"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Mode = "idle" | "password" | "link";

/**
 * Inline admin tools for a user row: set password OR generate sign-in
 * link, both without leaving the search page. Only one tool open at a
 * time per row to keep the layout tidy.
 */
export function UserToolsRow({
  profileId,
  hasEmail,
}: {
  profileId: string;
  hasEmail: boolean;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [pw, setPw] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function setPassword() {
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
      toast.push(error ?? "Failed", "error");
      return;
    }
    toast.push("Password updated", "success");
    setPw("");
    setMode("idle");
  }

  async function generateLink() {
    setLoading(true);
    const res = await fetch("/api/admin/signin-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "unknown" }));
      toast.push(error ?? "Failed", "error");
      return;
    }
    const { url, email } = await res.json();
    setLink(url);
    setLinkEmail(email);
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.push("Link copied", "success");
    } catch {
      toast.push("Copy failed — select manually", "error");
    }
  }

  return (
    <div className="border-t border-black/[0.06] pt-3 mt-2">
      {mode === "idle" ? (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setMode("password");
              setLink(null);
            }}
            variant="secondary"
            size="sm"
          >
            Set password
          </Button>
          <Button
            onClick={() => {
              setMode("link");
              setLink(null);
              if (hasEmail) generateLink();
            }}
            variant="secondary"
            size="sm"
            disabled={!hasEmail}
            title={hasEmail ? undefined : "User has no email — sign-in link needs one"}
          >
            Sign-in link
          </Button>
        </div>
      ) : null}

      {mode === "password" ? (
        <div className="space-y-2">
          <Field label="New password" hint="Minimum 8 characters">
            <Input
              type="text"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setPassword()}
              placeholder="Type a new password"
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={setPassword} loading={loading} size="sm">
              Save password
            </Button>
            <Button
              onClick={() => {
                setMode("idle");
                setPw("");
              }}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "link" ? (
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-ink-secondary">Generating…</p>
          ) : link ? (
            <>
              <p className="text-xs text-ink-secondary">
                Single-use, expires in ~1 hour. Send to{" "}
                <strong>{linkEmail}</strong>.
              </p>
              <div className="flex gap-2 items-start">
                <code className="flex-1 min-w-0 text-xs break-all font-mono text-ink-primary bg-bg-secondary border border-black/10 rounded p-2">
                  {link}
                </code>
                <button
                  onClick={copyLink}
                  className="btn-secondary text-xs shrink-0 py-2 px-3"
                >
                  Copy
                </button>
              </div>
            </>
          ) : null}
          <Button onClick={() => setMode("idle")} variant="ghost" size="sm">
            Close
          </Button>
        </div>
      ) : null}
    </div>
  );
}
