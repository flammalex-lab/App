import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel Hobby caps at 10s; Pro allows up to 60. We ask for 10 to document
// the Hobby target — Haiku vision matches a single image + compact candidate
// list in 2-4s typically, well inside the budget.
export const maxDuration = 10;

interface MatchBody {
  filename: string;
  producer: string | null;
  imageBase64: string; // data portion only (no "data:image/...;base64," prefix)
  imageMediaType: string; // e.g. image/jpeg
}

/**
 * Match a product image against the catalog. Two paths:
 *   1. Filename SKU match — if the filename contains any product's SKU
 *      substring, return that product directly. Fast + deterministic.
 *   2. Vision match — otherwise ask Claude which product the image shows,
 *      scoped to the producer filter if present. Returns confidence.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = (await request.json()) as MatchBody;
  if (!body?.imageBase64) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // (1) Filename SKU match. Pull all active SKUs once and scan the filename
  // for any of them. "IMG_spice4.png" → matches SKU "SPICE4" (case-insensitive).
  const { data: allSkuRows } = await svc
    .from("products")
    .select("id, sku, name, producer, pack_size, unit")
    .eq("is_active", true)
    .not("sku", "is", null);
  const allSkus = (allSkuRows as Array<{
    id: string;
    sku: string;
    name: string;
    producer: string | null;
    pack_size: string | null;
    unit: string;
  }> | null) ?? [];

  const filenameLower = body.filename.toLowerCase();
  const skuHit = allSkus.find(
    (p) => p.sku && filenameLower.includes(p.sku.toLowerCase()),
  );
  if (skuHit) {
    return NextResponse.json({
      match: {
        id: skuHit.id,
        sku: skuHit.sku,
        name: skuHit.name,
        producer: skuHit.producer,
        pack_size: skuHit.pack_size,
        unit: skuHit.unit,
      },
      source: "filename_sku",
      confidence: "high",
    });
  }

  // (2) Vision match. Scope candidates to the requested producer if given,
  // else to the full active catalog. Cap at 40 so the prompt stays tight.
  let q = svc
    .from("products")
    .select("id, sku, name, producer, pack_size, unit, description")
    .eq("is_active", true);
  if (body.producer?.trim()) {
    q = q.ilike("producer", `%${body.producer.trim()}%`);
  }
  const { data: candRows } = await q.order("name", { ascending: true }).limit(40);
  const candidates = (candRows as Array<{
    id: string;
    sku: string | null;
    name: string;
    producer: string | null;
    pack_size: string | null;
    unit: string;
    description: string | null;
  }> | null) ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ match: null, source: "no_candidates" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set on this deployment" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey });

  // Compact the candidate list for the prompt — keep it under ~2K tokens.
  const candidateLines = candidates
    .map(
      (c, i) =>
        `${i + 1}. [id=${c.id}] ${c.name}${c.pack_size ? ` · ${c.pack_size}` : ""}${c.producer ? ` · ${c.producer}` : ""}${c.description ? ` — ${c.description.slice(0, 120)}` : ""}`,
    )
    .join("\n");

  const visionResponse = await client.messages.create({
    // Haiku 4.5: fast + cheap for the "which of these products is this?"
    // task. Vision call stays well under the 10s Hobby cap. Override via
    // CLAUDE_VISION_MATCH_MODEL if the catalog gets big enough that you
    // want a stronger model and you're on Pro.
    model: process.env.CLAUDE_VISION_MATCH_MODEL ?? "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: body.imageMediaType as any,
              data: body.imageBase64,
            },
          },
          {
            type: "text",
            text: `Which product is shown in this image? Match it against this list:

${candidateLines}

Respond with ONLY a JSON object matching this exact shape, nothing else:
{"product_id": "<id or null>", "confidence": "high|medium|low|none", "reasoning": "<one sentence>"}

Be strict — if the image shows something not in the list, return product_id as null and confidence as "none". Don't guess based on color or shape alone when the product packaging or label clearly shows a different item.`,
          },
        ],
      },
    ],
  });

  const textBlock = visionResponse.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ match: null, source: "no_vision_response" });
  }
  let parsed: { product_id: string | null; confidence: string; reasoning: string };
  try {
    // Strip any accidental code fences or prose around the JSON.
    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    const jsonStr = jsonStart >= 0 && jsonEnd >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ match: null, source: "parse_error" });
  }

  const picked = parsed.product_id
    ? candidates.find((c) => c.id === parsed.product_id) ?? null
    : null;

  return NextResponse.json({
    match: picked
      ? {
          id: picked.id,
          sku: picked.sku,
          name: picked.name,
          producer: picked.producer,
          pack_size: picked.pack_size,
          unit: picked.unit,
        }
      : null,
    source: "vision",
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      producer: c.producer,
      pack_size: c.pack_size,
    })),
  });
}
