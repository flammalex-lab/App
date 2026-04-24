import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requireAdmin } from "@/lib/auth/session";

// Status polling route. Quick if prediction is still running; when
// complete, proxies the output image bytes back to the client (avoids
// CORS with replicate.delivery). Always well under 10s.
export const maxDuration = 10;

export async function GET(request: Request) {
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

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const client = new Replicate({ auth: token });
  let prediction;
  try {
    prediction = await client.predictions.get(id);
  } catch (e: any) {
    return NextResponse.json(
      { error: `replicate get failed: ${e?.message ?? "unknown"}` },
      { status: 502 },
    );
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    return NextResponse.json(
      { status: prediction.status, error: prediction.error ?? "prediction failed" },
      { status: 502 },
    );
  }

  if (prediction.status !== "succeeded") {
    // Still starting / processing — caller will poll again.
    return NextResponse.json({ status: prediction.status });
  }

  // Succeeded: stream the cutout image back to the client.
  const outputUrl = extractUrl(prediction.output);
  if (!outputUrl) {
    return NextResponse.json({ error: "no output URL" }, { status: 502 });
  }

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
    const maybeFn = (output as { url?: () => string | URL }).url;
    if (typeof maybeFn === "function") {
      const u = maybeFn.call(output);
      return typeof u === "string" ? u : u instanceof URL ? u.toString() : null;
    }
  }
  return null;
}
