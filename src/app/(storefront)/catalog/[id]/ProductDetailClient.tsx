"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export function ProductDetailClient({ product, unitPrice }: { product: Product; unitPrice: number }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
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
      <Button onClick={addToCart} size="lg">Add to cart</Button>
    </div>
  );
}
