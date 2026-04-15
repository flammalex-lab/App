"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export function ProductDetailClient({
  product,
  unitPrice,
  showAddToGuide,
}: {
  product: Product;
  unitPrice: number;
  showAddToGuide: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [inGuide, setInGuide] = useState<"idle" | "adding" | "added" | "exists">("idle");
  const add = useCart((s) => s.add);
  const router = useRouter();

  function addToCart() {
    add({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice,
      quantity: qty,
      notes: notes || undefined,
    });
    router.push("/cart");
  }

  async function addToGuide() {
    setInGuide("adding");
    const res = await fetch("/api/my-guide/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    });
    const json = await res.json().catch(() => ({}));
    setInGuide(res.ok ? (json.alreadyExisted ? "exists" : "added") : "idle");
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-2">
        <Field label="Qty">
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-24" />
        </Field>
      </div>
      <Field label="Notes (optional)" hint="e.g. cut 1.5 in thick, trim to 1/4 fat">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={addToCart} size="lg">Add to cart</Button>
        {showAddToGuide ? (
          <Button
            onClick={addToGuide}
            variant="secondary"
            loading={inGuide === "adding"}
            disabled={inGuide === "added" || inGuide === "exists"}
          >
            {inGuide === "added" ? "Added to guide ✓" : inGuide === "exists" ? "Already in guide" : "Add to my guide"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
