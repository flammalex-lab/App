"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Generates a one-time magic sign-in URL for this buyer and shows it so
 * the admin can paste it into their preferred channel. Useful while A2P
 * 10DLC is pending and phone OTP is blocked at the carrier.
 */
export function SigninLinkButton({ profileId }: { profileId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setUrl(null);
    const res = await fetch("/api/admin/signin-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "unknown" }));
      toast.push(error ?? "Failed to generate link", "error");
      return;
    }
    const { url, email } = await res.json();
    setUrl(url);
    setEmail(email);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Link copied", "success");
    } catch {
      toast.push("Copy failed — select manually", "error");
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={generate} loading={loading} variant="secondary" size="sm">
        Generate sign-in link
      </Button>
      {url ? (
        <div className="rounded-md border border-black/10 bg-bg-secondary p-3 space-y-2">
          <p className="text-xs text-ink-secondary">
            Single-use link, expires in about an hour. Send to{" "}
            <strong>{email}</strong>&rsquo;s owner via any channel.
          </p>
          <div className="flex gap-2 items-start">
            <code className="flex-1 min-w-0 text-xs break-all font-mono text-ink-primary bg-white border border-black/10 rounded p-2">
              {url}
            </code>
            <button
              onClick={copy}
              className="btn-secondary text-xs shrink-0 py-2 px-3"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
