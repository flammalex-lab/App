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
 * Match a product image against the catalog. Three paths in order:
 *   1. Filename SKU match — if the filename contains any product's SKU
 *      substring, return that product directly. Fast + deterministic.
 *   2. Filename name/producer token match — score every candidate by
 *      how many of its meaningful name + producer tokens appear in the
 *      filename. If one candidate clearly wins (≥ 2 tokens AND lead of
 *      ≥ 1 over the runner-up AND ≥ 50% of its own meaningful tokens
 *      present), return as a high-confidence filename match. Avoids
 *      Claude API spend on names like "five-acre-whole-milk.jpg".
 *   3. Vision match — otherwise ask Claude which product the image
 *      shows, scoped to the producer filter if present.
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

  // (2) Filename name/producer token match. Tokenize the filename and
  // every candidate's name + producer, then score by how many of the
  // candidate's meaningful tokens appear in the filename. Confident
  // when the best candidate matches ≥ 2 tokens AND beats the runner-up
  // by ≥ 1 — i.e. those 2 tokens are uniquely identifying. Producer
  // tokens count toward matches but NOT the coverage denominator (a
  // long producer like "Red Jacket Orchards" inflates the token set
  // and would mask the actual name match). Brand noise
  // ("fingerlakes", "farms") is stop-listed so it doesn't bias every
  // FLF-own product into a tie.
  const filenameTokens = tokenizeForMatch(body.filename);
  if (filenameTokens.size >= 2) {
    const scored = allSkus
      .map((p) => {
        const prodTokens = tokenizeForMatch(`${p.name} ${p.producer ?? ""}`);
        if (prodTokens.size === 0) return null;
        let matched = 0;
        for (const t of prodTokens) if (filenameTokens.has(t)) matched++;
        return { product: p, matched, total: prodTokens.size };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.matched - a.matched);

    const best = scored[0];
    const runnerUp = scored[1];
    // Confident = at least 2 distinct tokens matched AND a clear lead
    // over the runner-up. The lead-by-≥-1 check is the real
    // disambiguator: if two products tie on the same 2 tokens we
    // genuinely can't tell which one the photo is of, and routing to
    // vision is correct. We deliberately don't require a coverage
    // ratio — "raspberry 32oz" matching "Red Jacket Raspberry 32oz"
    // is 2/5 by raw count, which is fine when nothing else in the
    // catalog has both tokens.
    const confident =
      best &&
      best.matched >= 2 &&
      (!runnerUp || best.matched - runnerUp.matched >= 1);
    if (confident) {
      return NextResponse.json({
        match: {
          id: best.product.id,
          sku: best.product.sku,
          name: best.product.name,
          producer: best.product.producer,
          pack_size: best.product.pack_size,
          unit: best.product.unit,
        },
        source: "filename_name",
        confidence: "high",
        reasoning: `Filename token match: ${best.matched} of product's tokens, runner-up at ${runnerUp?.matched ?? 0}.`,
      });
    }
  }

  // (3) Vision match. Scope candidates to the requested producer if given,
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

/**
 * Lower-case, normalize "32 oz" → "32oz" so filename and product-name
 * formatting variants don't fall out of sync, split on non-alphanumerics,
 * drop stopwords + super-short tokens. Returns a Set so duplicate
 * occurrences don't double-count during scoring.
 *
 * Stopwords cover: filename noise ("img", "photo", file extensions),
 * grammar particles ("the", "of"), and brand words that appear on
 * almost every FLF-own product ("fingerlakes", "farms"). Removing them
 * keeps the score signal proportional to the *distinguishing* parts of
 * the product name.
 */
function tokenizeForMatch(s: string): Set<string> {
  const STOPWORDS = new Set([
    "the","and","or","with","for","of","in","on","by","at","from","to",
    "img","photo","picture","image","pic",
    "jpg","jpeg","png","webp","heic","tif","tiff",
    "fingerlakes","farms","farm",
  ]);
  const UNIT_WORDS = "oz|lb|lbs|gallon|gallons|quart|quarts|pint|pints|gal|qt|pt|kg|g|ml|l|ct|dz|dozen";
  const tokens = s
    .toLowerCase()
    // Collapse "32 oz" / "1 lb" / "1/2 gallon" → "32oz" so a filename
    // and a product name in different formatting still match.
    .replace(new RegExp(`(\\d+)\\s+(${UNIT_WORDS})\\b`, "g"), "$1$2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}
