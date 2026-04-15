import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/supabase/types";
import { ProductForm } from "./ProductForm";

export default async function AdminProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl mb-4">New product</h1>
        <ProductForm product={null} />
      </div>
    );
  }
  const db = await createClient();
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl mb-4">Edit product</h1>
      <ProductForm product={data as Product} />
    </div>
  );
}
