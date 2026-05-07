#!/usr/bin/env node
/**
 * Claude PR review — triggered by .github/workflows/pr-review.yml
 *
 * Fetches the PR diff, sends it to Claude with a project-specific system
 * prompt (prompt-cached so subsequent runs pay ~10% for the shared prefix),
 * parses the structured JSON response, posts a comment on the PR, and
 * exits non-zero if any finding is tagged severity=critical.
 *
 * The system prompt lists the pitfalls this repo has actually hit:
 *  - .maybeSingle() on queries that can return >1 row (0010 default-guides dedupe)
 *  - writing a migration without the CLAUDE.md-mandated reminder to apply it
 *  - RLS missing / malformed on new tables
 *  - Unchecked errors on Supabase inserts/updates that then silently "succeed"
 *  - Multiple-default rows (no unique partial index)
 *  - Scanning session, cache, or cookie data in unsafe ways
 *
 * Use: ran in CI. Not a local dev tool. Node 20+; uses built-in fetch.
 */

import Anthropic from '@anthropic-ai/sdk';

const {
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  PR_NUMBER,
  PR_TITLE,
  PR_BODY,
  REPO,
  BASE_SHA,
  HEAD_SHA,
} = process.env;

if (!ANTHROPIC_API_KEY || !GITHUB_TOKEN || !PR_NUMBER || !REPO) {
  console.error('[pr-review] missing required env. Need ANTHROPIC_API_KEY, GITHUB_TOKEN, PR_NUMBER, REPO.');
  process.exit(2);
}

const MODEL = 'claude-opus-4-7';
const MAX_DIFF_BYTES = 200_000; // ~50K tokens — clip huge PRs so we don't blow context

// --- 1. Fetch the PR diff from GitHub REST API -----------------------------

async function fetchDiff() {
  const url = `https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3.diff',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub diff fetch failed: ${res.status} ${await res.text()}`);
  }
  let diff = await res.text();
  if (diff.length > MAX_DIFF_BYTES) {
    diff = diff.slice(0, MAX_DIFF_BYTES) + `\n\n[...diff truncated at ${MAX_DIFF_BYTES} bytes...]`;
  }
  return diff;
}

async function fetchChangedFiles() {
  const url = `https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.map((r) => ({ filename: r.filename, additions: r.additions, deletions: r.deletions, status: r.status }));
}

// --- 2. Ask Claude for a structured review ---------------------------------

const SYSTEM_PROMPT = `You are reviewing a pull request in the Fingerlakes Farms (FLF) portal — a
Next.js 14 App Router B2B ordering portal backed by Supabase (Postgres +
RLS + Realtime), Twilio (phone OTP + SMS), and Stripe. The buyer-side is a
PWA. Admin manages accounts, buyers, order guides, templates, and orders.

YOUR JOB: return a JSON object with a "findings" array. Each finding has:
  file      — path of the file with the issue (string)
  line      — line number in the new file (integer | null)
  severity  — one of: "critical", "major", "minor", "nit"
  category  — short tag like "rls", "migration", "supabase-query",
              "error-handling", "auth", "data-loss", "type-safety", "ux"
  title     — one-line summary
  explanation — 2-4 sentences explaining the issue and the blast radius
  fix       — concrete suggestion

Severity rubric:
  critical  — Data loss risk, auth bypass, SQL/XSS injection, missing RLS on
              a new sensitive table, or a bug that will silently corrupt prod
              state on first use. Fails the check and blocks merge.
  major     — Real bug or design hole that will break in common cases.
              Ship-blocker in review but not "stop the build."
  minor     — Worth fixing before merge but not urgent. Ergonomics, naming,
              minor UX inconsistency.
  nit       — Style, comment, naming preference. Optional.

Be concrete and short. Quote the problematic line when it helps. Don't nag
about things the code is deliberately not doing. Don't flag unchanged code.

KNOWN PITFALLS THIS REPO HAS ALREADY HIT — flag recurrences immediately:

1. **\`.maybeSingle()\` on a query that can return more than one row.** PostgREST
   returns an error object (which our code routinely ignores) when multiple
   rows match. Classic case: \`.eq("is_default", true).maybeSingle()\` on
   \`order_guides\` when duplicate defaults accumulated. Flag as critical.
   Prefer \`.order(...).limit(1)\` + take the first row.

2. **New migration without the CLAUDE.md reminder.** If the diff adds or
   alters a file in \`supabase/migrations/\`, the PR description or a comment
   must remind Alex to apply it in Supabase. Flag if the migration lands
   without that callout. Severity: major.

3. **New table without RLS.** Every new table in migrations must include
   \`alter table X enable row level security;\` and at least one admin policy.
   Missing RLS on a table that holds buyer/account/order data is critical.

4. **Unchecked Supabase write.** Patterns like
   \`await svc.from("X").insert(row);\` without checking \`.error\` — the
   function returns 200 to the client, DB write failed silently. Flag as
   major. Exception: fire-and-forget audit logs where we genuinely don't
   care.

5. **Multiple "default" rows.** Anything with an \`is_default boolean\`
   should have a unique partial index (\`where is_default = true\`) to prevent
   the bug we hit with duplicate default order guides. Flag if a new table
   adds \`is_default\` without that index.

6. **Service-role client in client-side code.** \`createServiceClient()\` must
   only appear in \`"use server"\`, API routes, or \`src/lib/**\` modules that
   are imported only from server contexts. Critical if it's imported into
   a \`"use client"\` file.

7. **Auth impersonation outside admin gates.** Any read of the impersonation
   cookie via \`getImpersonation()\` must be gated by
   \`session.profile.role === "admin"\`. Critical if not.

8. **Cart/order data shape changes.** The cart is persisted in
   localStorage via Zustand. Changing \`CartLine\` shape without a persist
   migration strips existing buyers' carts. Flag as major.

9. **Hard-deleting a row with order FKs.** Orders reference profiles/accounts
   with \`on delete restrict\`. Any UI that deletes profiles/accounts must
   gate on "has no orders" or use soft-delete. Critical if a hard delete
   can fire against a buyer with order history.

10. **Twilio SMS without opt-out respect.** SMS send code must not fire to
    numbers flagged as opted out. Twilio handles STOP at the carrier level,
    but app-initiated sends must also not loop. Flag as major if a new
    send site bypasses the \`sendSms\` helper.

11. **Cache-control or invalidator on dynamic user data.** Don't cache
    responses that contain buyer-specific pricing, guides, or orders. Flag
    as critical if \`Cache-Control: public\` lands on such a route.

12. **Breaking changes to variant fields.** Cart uses \`variantKey\`,
    \`variantSku\`, \`priceByWeight\`. Don't rename or drop these without a
    cart-store persist migration. Major.

OUTPUT FORMAT — strictly JSON matching this TypeScript type, no prose:

{
  "summary": string, // 1-2 sentence TL;DR of the PR and the review
  "findings": [
    {
      "file": string,
      "line": number | null,
      "severity": "critical" | "major" | "minor" | "nit",
      "category": string,
      "title": string,
      "explanation": string,
      "fix": string
    }
  ]
}

If the PR looks clean, return { "summary": "...", "findings": [] }.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: ['integer', 'null'] },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'nit'] },
          category: { type: 'string' },
          title: { type: 'string' },
          explanation: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'line', 'severity', 'category', 'title', 'explanation', 'fix'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'findings'],
  additionalProperties: false,
};

async function callClaude({ diff, changedFiles, title, body }) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const filesSummary = changedFiles
    .map((f) => `${f.status.padEnd(10)} +${f.additions} -${f.deletions}  ${f.filename}`)
    .join('\n');

  const userPrompt = `PR #${PR_NUMBER}: ${title}

${body ? `Description:\n${body}\n\n` : ''}Changed files (${changedFiles.length}):
${filesSummary}

DIFF:
${diff}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16_000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    system: [
      // Cache-control on the big static system prompt — every run pays ~10%
      // of the prefix instead of full price once the cache warms.
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Extract JSON from the text block.
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text block');
  const usage = response.usage;
  console.log(
    `[pr-review] tokens: in=${usage.input_tokens} out=${usage.output_tokens} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
  );
  return JSON.parse(textBlock.text);
}

// --- 3. Render a markdown comment -----------------------------------------

const SEV_EMOJI = { critical: '🛑', major: '⚠️', minor: '💡', nit: '✏️' };
const SEV_ORDER = { critical: 0, major: 1, minor: 2, nit: 3 };

function renderComment({ summary, findings }) {
  const sorted = [...findings].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const counts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  const header = [
    `### Claude review`,
    ``,
    summary,
    ``,
    Object.entries(counts)
      .sort(([a], [b]) => SEV_ORDER[a] - SEV_ORDER[b])
      .map(([sev, n]) => `${SEV_EMOJI[sev]} ${n} ${sev}`)
      .join(' · ') || '✅ no findings',
    ``,
  ].join('\n');

  if (sorted.length === 0) {
    return header + '\nLooks clean from Claude\'s read.';
  }

  const body = sorted
    .map((f) => {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      return [
        `**${SEV_EMOJI[f.severity]} ${f.severity.toUpperCase()} · ${f.category}** — ${f.title}`,
        `\`${loc}\``,
        ``,
        f.explanation,
        ``,
        `_Fix:_ ${f.fix}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  return header + '\n' + body + '\n\n<sub>Automated review · not a substitute for human code review</sub>';
}

async function postComment(markdown) {
  const url = `https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: markdown }),
  });
  if (!res.ok) {
    throw new Error(`GitHub comment failed: ${res.status} ${await res.text()}`);
  }
}

// --- 4. Main --------------------------------------------------------------

async function main() {
  const [diff, changedFiles] = await Promise.all([fetchDiff(), fetchChangedFiles()]);
  if (!diff.trim()) {
    console.log('[pr-review] empty diff — skipping');
    return;
  }

  const review = await callClaude({
    diff,
    changedFiles,
    title: PR_TITLE ?? `PR #${PR_NUMBER}`,
    body: PR_BODY ?? '',
  });

  console.log(`[pr-review] summary: ${review.summary}`);
  console.log(`[pr-review] findings: ${review.findings.length}`);

  await postComment(renderComment(review));

  const critical = review.findings.filter((f) => f.severity === 'critical');
  if (critical.length > 0) {
    console.error(`[pr-review] ${critical.length} critical finding(s) — failing check`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[pr-review]', err);
  // Don't fail the PR check on our own tool errors — just log.
  process.exit(0);
});
