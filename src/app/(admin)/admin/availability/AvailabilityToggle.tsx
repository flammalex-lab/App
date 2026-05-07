"use client";

import { useState } from "react";

export function AvailabilityToggle({ productId, initial }: { productId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !on;
    const res = await fetch(`/api/admin/products/${productId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available_this_week: next }),
    });
    setLoading(false);
    if (res.ok) setOn(next);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-3 py-1.5 rounded-full text-sm transition ${on ? "bg-brand-green text-white" : "bg-black/5 text-ink-secondary"}`}
    >
      {on ? "In stock" : "Off"}
    </button>
  );
}
