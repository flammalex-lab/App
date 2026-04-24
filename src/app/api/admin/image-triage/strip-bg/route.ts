import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requireAdmin } from "@/lib/auth/session";

// Replicate's rembg model usually returns in 3–10s on a warm machine but
// can cold-start to ~30s. Give the function headroom.
export const maxDuration = 90;

/**
 * Default model: 851-labs/background-remover (BRIA RMBG-1.4 — fast, clean
 * results on packaged-goods product photos). If a newer version drops, set
 * REPLICATE_BG_MODEL on the deployment to override without a redeploy:
 *
 *   REPLICATE_BG_MODEL="851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc"
 *
 * You can pin either "owner/model" (uses latest version) or
 * "owner/model:versionHash" (pinned). We accept the string verbatim.
 */
const DEFAULT_MODEL =
  "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN is not set on this deployment" },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
  if (!image || !(image instanceof File)) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
  }

  // Replicate accepts data URLs for the `image` input; no need to host
  // the upload anywhere first.
  const bytes = Buffer.from(await image.arrayBuffer()).toString("base64");
  const mime = image.type || "image/jpeg";
  const dataUrl = `data:${mime};base64,${bytes}`;

  const modelRef = (process.env.REPLICATE_BG_MODEL ?? DEFAULT_MODEL) as `${string}/${string}:${string}`;
  const client = new Replicate({ auth: token });

  let output: unknown;
  try {
    output = await client.run(modelRef, {
      input: { image: dataUrl },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `replicate failed: ${e?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  // Replicate returns either a URL string or an array with one (depending
  // on the model). Newer SDKs may also wrap output in a FileOutput class
  // with .url(). Handle all three.
  const outputUrl = extractUrl(output);
  if (!outputUrl) {
    return NextResponse.json({ error: "replicate returned no image URL" }, { status: 502 });
  }

  // Fetch the cutout from Replicate's CDN and stream it back to the
  // client as an image/png — avoids CORS headaches and keeps the
  // Replicate URL server-side.
  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) {
    return NextResponse.json(
      { error: `fetch cutout failed: ${imgRes.status}` },
      { status: 502 },
    );
  }
  const body = await imgRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

function extractUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    return extractUrl(output[0]);
  }
  if (output && typeof output === "object") {
    // FileOutput class from replicate SDK has .url()
    const maybeFn = (output as { url?: () => string | URL }).url;
    if (typeof maybeFn === "function") {
      const u = maybeFn.call(output);
      return typeof u === "string" ? u : u instanceof URL ? u.toString() : null;
    }
  }
  return null;
}
