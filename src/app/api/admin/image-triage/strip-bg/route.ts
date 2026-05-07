import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requireAdmin } from "@/lib/auth/session";

// Quick-start route: creates the prediction and returns immediately with
// the prediction id. Client polls /strip-bg/status for the result. Keeps
// every request well under the 10s Vercel Hobby cap.
export const maxDuration = 10;

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

  const bytes = Buffer.from(await image.arrayBuffer()).toString("base64");
  const mime = image.type || "image/jpeg";
  const dataUrl = `data:${mime};base64,${bytes}`;

  const modelRef = process.env.REPLICATE_BG_MODEL ?? DEFAULT_MODEL;
  const [, versionHash] = modelRef.split(":");
  if (!versionHash) {
    return NextResponse.json(
      { error: "REPLICATE_BG_MODEL must be 'owner/model:versionHash'" },
      { status: 500 },
    );
  }

  const client = new Replicate({ auth: token });
  try {
    const prediction = await client.predictions.create({
      version: versionHash,
      input: { image: dataUrl },
    });
    return NextResponse.json({ predictionId: prediction.id, status: prediction.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: `replicate create failed: ${e?.message ?? "unknown"}` },
      { status: 502 },
    );
  }
}
