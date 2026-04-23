"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ReseedGuideButton({
  profileId,
  guideCount,
}: {
  profileId: string;
  guideCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function reseed(replace: boolean) {
    setLoading(true);
    const res = await fetch(`/api/admin/buyers/${profileId}/seed-guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Seed failed", "error");
      return;
    }
    const { seeded } = (await res.json()) as { seeded: number };
    if (seeded > 0) {
      toast.push(`Guide seeded with ${seeded} items`, "success");
      router.refresh();
    } else {
      toast.push("No matching products found — check product_group / category on your catalog", "error");
    }
  }

  if (guideCount > 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        loading={loading}
        onClick={() => {
          if (confirm(`Replace all ${guideCount} items with fresh starter items? This can't be undone.`)) {
            reseed(true);
          }
        }}
      >
        Re-seed guide
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={() => reseed(false)}>
      Seed starter items
    </Button>
  );
}
