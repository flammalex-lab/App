import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Upload a product image to the product-images bucket and set it as the
 * product's image_url. Overwrites any existing image for that product.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const form = await request.formData();
  const image = form.get("image");
  const productId = form.get("product_id") as string | null;
  if (!image || !(image instanceof File)) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Resolve file extension from mime type; fallback to whatever's in name.
  const mime = image.type || "image/jpeg";
  const extFromMime = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${productId}.${extFromMime}`;

  const buffer = new Uint8Array(await image.arrayBuffer());

  const { error: uploadErr } = await svc.storage
    .from("product-images")
    .upload(path, buffer, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000", // 1 year — path has productId, so stable per product
    });
  if (uploadErr) {
    return NextResponse.json({ error: `upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: urlData } = svc.storage.from("product-images").getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: "no public URL returned" }, { status: 500 });
  }

  // Bust CDN cache if the admin re-uploads the same product.
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;
  const { error: updateErr } = await svc
    .from("products")
    .update({ image_url: cacheBustedUrl })
    .eq("id", productId);
  if (updateErr) {
    return NextResponse.json({ error: `product update failed: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, image_url: cacheBustedUrl });
}
