# FLF Portal — Full Project Audit

**Branch:** `claude/full-project-audit-V6iJO`
**Date:** 2026-05-09
**Scope:** Full repo — security, schema, code quality, performance, business logic, dependencies, tests.

## Baseline checks

| Check       | Result |
|-------------|--------|
| `tsc --noEmit` | clean |
| `next lint`    | clean |
| `jest`         | 4 suites, 52 tests passing |
| `npm audit`    | **5 vulns** (4 high in `next@14.2.35`, 1 moderate in `postcss`) |
| Source files   | 220 .ts/.tsx |
| Migrations     | 19 SQL files |
| Test coverage  | 4 unit-test files (cutoff, pricing, two standing-order) |

The codebase is well-structured and the green typecheck/lint/test signals are real — but the test suite covers ~3 pure-function utilities and zero of the 45+ API routes / webhooks / middleware. So "all green" understates risk.

---

## 🔴 Critical

### C1. Privilege escalation: any signup can self-promote to `admin`
**File:** `supabase/migrations/0002_rls.sql:141`
```sql
coalesce((new.raw_user_meta_data->>'role')::role_t, 'dtc_customer')
```
`raw_user_meta_data` is supplied by the *client* on `supabase.auth.signUp({ options: { data: { role: 'admin' }}})` and is settable with the public anon key. Any visitor can sign up with `role: "admin"` and the trigger writes them straight into `profiles.role = 'admin'`. From there `is_admin()` returns true, RLS opens up, and the impersonation, QB, pricing, and accounts surfaces are all unlocked.
**Fix:** drop the `raw_user_meta_data->>'role'` read entirely; default everyone to `dtc_customer`. Only an existing admin (or a SQL editor / service-role call) should be able to flip `profiles.role`.

### C2. Cron endpoints run **unauthenticated** when `CRON_SECRET` is unset
**Files:** `src/app/api/cron/standing-orders/route.ts:14`, `src/app/api/cron/reorder-prompts/route.ts:15`
```ts
if (secret && auth !== `Bearer ${secret}`) return … 403
```
The `secret &&` guard means: if you forget to set `CRON_SECRET` in any environment (preview, staging, a misconfigured prod redeploy), **the cron endpoints become public**. Anyone can hit `/api/cron/standing-orders` to force-create draft orders + send confirmation SMS to every active account, or hit `/api/cron/reorder-prompts` to spam every buyer's phone.
**Fix:** invert the check —
```ts
if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "forbidden" }, { status: 403 });
```
Bonus: use `crypto.timingSafeEqual` (you already have a helper at `src/lib/twilio/client.ts:80`).

---

## 🟠 High

### H1. Impersonation cookie is unsigned and target is never validated
**Files:** `src/lib/auth/impersonation.ts:18`, `src/app/api/admin/impersonate/start/route.ts:13`
The cookie is the raw target `profileId` (a UUID) with no HMAC. The audit-log row is inserted *before* validating the target exists, so `POST /api/admin/impersonate/start?profileId=00000000-0000-0000-0000-000000000000` writes a phantom log row, then sets a cookie pointing at nothing. More importantly, every downstream RSC trusts the cookie value — if an admin's session is hijacked (XSS, malicious extension, leaked dev-tools cookie), the attacker has 4 hours of effective service-role access to **any profile**, including other admins, with no per-request re-auth.
**Fix:** (a) sign the cookie with a server secret (HMAC of `profileId|expiry`) and verify on every read; (b) validate the target profile exists and is not itself an admin before logging or setting; (c) add `path: "/"`-scoped expiry plus a periodic re-auth (`requireAdmin()` on every server action that consumes impersonation).

### H2. Open redirect on `/auth/callback`
**File:** `src/app/auth/callback/route.ts:7,13`
```ts
const next = searchParams.get("next") ?? "/";
return NextResponse.redirect(`${origin}${next}`);
```
`next` is concatenated unsanitized. `?next=@evil.com` produces `https://flf.app@evil.com` — userinfo-style URL the browser navigates to `evil.com`. `?next=//evil.com/x` is similarly fragile across browser parsers and proxies. Phishers use OAuth-callback open redirects to steal session tokens.
**Fix:** require `next.startsWith("/")` and reject if it starts with `//` or `/\\`. One-liner:
```ts
const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
```

### H3. Twilio inbound-SMS signature verification skipped outside production
**File:** `src/app/api/sms/inbound/route.ts:21`
```ts
if (!valid && process.env.NODE_ENV === "production") return … 403;
```
Reads as: in dev/preview, **signature failures are silently ignored** and the (unauth) request is processed — anyone can POST forged SMS into the messages table for any phone number, impersonating buyers in the rep thread. Vercel preview deploys often run with `NODE_ENV=production` so this may already be fine on Vercel, but local + staging + any branch deploy that flips NODE_ENV is exposed.
**Fix:** drop the env gate. If you need a local-dev escape hatch, gate on a separate `ALLOW_UNSIGNED_TWILIO=true` so prod can never accidentally inherit it.

### H4. `next@14.2.35` has 4 high-severity CVEs
**File:** `package.json:22`
`npm audit` flags Image Optimizer remote-pattern DoS, RSC HTTP-request deserialization, rewrites smuggling, unbounded image-cache disk growth, and Server-Components DoS. Postcss XSS via `</style>` (moderate) ships transitively.
**Fix:** bump to the latest patched 14.2.x (verify `next@14.2.x` ≥ the latest patched release for these advisories). If 14 is no longer patched for these specifically, schedule a 14→15 (or 14→16) upgrade with a typecheck/test pass — App Router code is mostly compatible.

### H5. Cutoff & standing-order math runs in server-local time, not the account's zone
**Files:** `src/lib/utils/cutoff.ts:32`, `src/lib/utils/standing-order.ts:22`
```ts
candidate.setHours(9, 0, 0, 0); // assume 9am delivery time
startFrom.setHours(6, 0, 0, 0); // run-time: 6am
```
On Vercel serverless functions the process tz is **UTC**, so "9am" is 9am UTC = 5am ET in summer / 4am ET in winter. The CutoffClock displays the cutoff in the buyer's tz, but the *rollover decision* ("did 9am pass?") happens in UTC. Result: your cutoff clock reads "T-3h" while the server already considers cutoff passed (or vice versa). Across DST transitions you'll see a one-day skip.
**Fix:** thread a `timezone` (e.g. `"America/New_York"`) through `nextDeliveryForZone()` and `computeNextRun()`; do all date arithmetic in that zone using `Intl.DateTimeFormat` with `timeZone` or a small lib (`@date-fns/tz`). Existing tests pass because they use local-time constructors that match the server's tz.

### H6. Stripe webhook updates order on `checkout.session.completed` — no failure/dispute handling, no idempotency
**File:** `src/app/api/stripe/webhook/route.ts:22-32`
The handler only listens for the success event. There's no `payment_intent.payment_failed` (failed cards still leave the order in `pending`/`unpaid`), no `charge.refunded`/`charge.dispute.created` (chargebacks never flip the order off `paid`), and no `event.id` dedupe (Stripe retries on 5xx — currently safe by accident because the update is idempotent on `id`, but if you add side-effects later this becomes a footgun).
**Fix:** add the failure/refund/dispute event types and a one-row `stripe_events(id pk)` insert at the top to short-circuit retries.

### H7. Admin product-status updates use `(prev as any).order_number` and similar throughout
**File:** `src/app/api/admin/orders/[id]/update/route.ts:22-33` (and 87 total `as any` casts in `src/`)
Every Supabase response is being re-typed with `as any` and then field-accessed by string. Lint/typecheck pass because the unsafe cast launders the type. When a column rename or migration drops/renames a field, none of these break at compile time — they ship and silently send "FLF: order undefined confirmed" SMS to every customer.
**Fix:** generate Supabase types (`supabase gen types typescript --linked > src/lib/supabase/types.gen.ts`) and replace the catch-all `Database = any` in `lib/supabase/types.ts` with the generated `Database`. Then `from("orders")` returns properly-typed rows and you can delete every `as any`.

### H8. No CI gate on lint / typecheck / tests
**File:** `.github/workflows/pr-review.yml`
The only workflow runs the Claude PR-review script. `npm run lint`, `npm run typecheck`, and `npm test` are never invoked on PR. A regression that breaks the type checker or trips a Jest assertion can be merged.
**Fix:** add a sibling job (no AI key needed) that runs `npm ci && npm run lint && npm run typecheck && npm test -- --ci`, and require it as a status check in branch protection.

---

## 🟡 Medium

### M1. `orders.account_id` is nullable + `on delete set null`
**File:** `supabase/migrations/0001_init.sql:199`
```sql
account_id uuid references accounts(id) on delete set null,
```
RLS scopes orders by `account_id = my_account_id()`. An order with `account_id IS NULL` is invisible to the buyer, invisible to the rep's account view, but still exists in the table — orphaned revenue. Whether or not the soft-delete path is currently exercised, the door is open.
**Fix:** backfill / void any orphans, then `alter table orders alter column account_id set not null`. Use `on delete restrict` for the FK (or soft-delete accounts).

### M2. Standing-orders RLS doesn't honor multi-account membership
**File:** `supabase/migrations/0002_rls.sql:100`
```sql
create policy "standing owner" on standing_orders
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
```
Migration 0007 introduced multi-account profiles. A buyer attached to accounts A+B sees standing orders by `profile_id` only — fine for the single-account legacy case, but if a profile is moved between accounts the attached `account_id` on the row no longer reflects the active account. There's no `account_id = current_active_account()` filter.
**Fix:** join through `profile_accounts` and use the active-account cookie value (or set a session GUC).

### M3. Inbound-SMS handler reads legacy `profile.account_id`, ignoring multi-account
**File:** `src/app/api/sms/inbound/route.ts:31-37`
```ts
.from("profiles").select("id, account_id").eq("phone", fromPhone).maybeSingle();
if (!profile?.account_id) { console.warn(…); return … }
```
A buyer who is multi-account (post-0007) but whose legacy `profiles.account_id` is null has their inbound SMS silently dropped. The rep sees nothing. Buyers who **are** multi-account land their SMS in the legacy column's account, not the active one.
**Fix:** look up `profile_accounts` and either (a) require explicit account selection in the SMS body, or (b) post the message into a profile-scoped null-account thread (you already have the policy from migration 0014).

### M4. Service-worker hardcoded cache name `flf-v1` — no version on deploy
**File:** `public/sw.js:4` `const CACHE = "flf-v1";`
The activate handler purges *other* cache names, but the name never changes, so a deploy of a new shell still serves the previous one until a hard reload. CLAUDE.md already lists this as a recurring "I don't see my changes" symptom.
**Fix:** template the build ID into the cache name. Either (a) move sw.js to a route handler that interpolates `process.env.NEXT_PUBLIC_BUILD_ID` (set in `next.config.js` from `git rev-parse HEAD`), or (b) inline `Math.random()` at build into `next.config.js`'s sw rewrite. Combine with `Cache-Control: no-cache` already set at `next.config.js:16`.

### M5. Service worker caches **every** navigation response, including 401/500/redirects
**File:** `public/sw.js:33-34`
```ts
const copy = res.clone();
caches.open(CACHE).then((c) => c.put(req, copy));
```
No `if (res.ok)` guard. A momentary 500 from a flaky deploy gets pinned into the cache and served offline forever. A 302 to `/login` from a flapping session cookie gets cached and the user can never reach `/guide` again until they manually clear site data.
**Fix:** `if (res.ok && res.status < 400) caches.open(CACHE).then(c => c.put(req, copy));` — and skip caching responses with `Cache-Control: no-store` or `Set-Cookie`.

### M6. No global security headers
**File:** `next.config.js:10-20`
The `headers()` block only sets headers for `/sw.js`. No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, or HSTS for the rest of the app. CSP would also catch any future XSS vector cold.
**Fix:** add a `{ source: "/(.*)" }` rule with at minimum:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=()`
- A starter CSP scoped to your real script/img/connect sources.

### M7. IIF export does not escape tabs / newlines in customer name, memo, description
**File:** `src/lib/accounting/iif-export.ts:67,82,84`
IIF is tab-delimited. If a customer name (`accounts.name`) or product description contains a tab or newline (paste from Google Sheets, accidental enter in admin form) the row breaks and QuickBooks silently drops the invoice or imports it under the wrong customer. CSV export at `iif-export.ts:135` does escape correctly — IIF doesn't.
**Fix:** add a `iifCell(v)` helper that strips/replaces `\t`, `\n`, `\r` (replace with space) and pipes through every field at lines 60-89.

### M8. No order-create-time validation of minimum + delivery fee
**File:** `src/app/api/orders/create/route.ts` (the cart blocks under-minimum, but the API does not re-validate)
The cart UX hides the "Place order" button if `subtotal < accountMinimum` (`src/app/(storefront)/cart/CartClient.tsx:76`), but the server-side `POST /api/orders/create` doesn't reject the request. A misbehaving client (or a paused-React-state edge) can submit an under-minimum order. Also, the cart compares raw `subtotal` against the minimum — but B2B orders carry a delivery fee (migration 0008). Inconsistent enforcement layers = revenue leakage either way.
**Fix:** centralize the rule in one server-side function (`canPlaceOrder({subtotal, deliveryFee, minimum})`); call it from the API route and from a server action that the cart hits before showing "Place order".

### M9. `/auth/signin-link` and `/auth/sms-consent` etc. — verify rate limiting end-to-end
**Files:** `src/app/api/admin/signin-link/route.ts`, `src/app/api/auth/*`
The phone-OTP path is delegated to Supabase (which has built-in throttling), but custom flows like `signin-link` send Twilio SMS through your account directly. Without a lightweight in-app rate-limit, an attacker can drain your Twilio balance and trigger A2P spam flags (= number suspended).
**Fix:** add a per-IP and per-phone limiter (e.g. `@upstash/ratelimit` with Vercel KV) — 5/min/IP, 3/hr/phone.

### M10. `next.config.js` `images.remotePatterns: "*.supabase.co"` is wildcarded
**File:** `next.config.js:6`
Allows the Next image optimizer to fetch from any Supabase project's storage, not just yours. Fine in practice, but combined with the H4 image-optimizer DoS CVE this widens the attack surface.
**Fix:** pin to your project: `{ protocol: "https", hostname: "<project-ref>.supabase.co" }`.

### M11. No unique index on `account_pricing(account_id, product_id)` for query performance
**File:** `supabase/migrations/0001_init.sql:130-138`
There's a unique constraint (which auto-creates a btree), so this is **probably fine** on most Postgres versions — but worth confirming the unique constraint covers the query pattern (`where account_id = ? and product_id = ?`) and that there's no separate `effective_date` window query that scans. Same check for `price_list_items` (`0019_customer_specific_pricing.sql:62`).
**Fix:** confirm `\d account_pricing` shows a btree on `(account_id, product_id)`; if your effective-date queries hit `price_list_items`, add a partial index `where (now() between effective_date and coalesce(expiry_date, 'infinity'))`.

### M12. No pagination on admin Orders / Messages list pages
**Files:** `src/app/(admin)/admin/orders/page.tsx`, `src/app/(admin)/admin/messages/page.tsx`
Hardcoded `limit(200)` / 500-row scan with JS-side dedupe. Fine at 100 accounts, painful at 1000.
**Fix:** add cursor pagination (`created_at < ?`); for messages, `select distinct on (account_id) … order by account_id, created_at desc`.

### M13. Cutoff `pastCutoff` field is dead — always `false`
**File:** `src/lib/utils/cutoff.ts:41`
The function only returns when it finds a delivery whose cutoff is in the future, so `pastCutoff: false` is the only value ever produced (the field is hardcoded). Anywhere in the UI that branches on `pastCutoff` is dead code.
**Fix:** either delete the field, or refactor to also return the *first matching delivery* even when its cutoff has passed, with `pastCutoff: true` so the UI can render "cutoff passed — your order will land on the next window".

---

## 🟢 Low / Polish

- **L1.** `venmo_handle: '@alex_flamm'` lives in seed migration `supabase/migrations/0001_init.sql:374`. Personal handle hardcoded in source. Move to env var or to `qb_settings` row created at first-admin setup.
- **L2.** `tsconfig.json` is `strict: true` but missing `noUncheckedIndexedAccess`. Turning that on will catch a chunk of the 87 `as any` casts (e.g. `params[k]` patterns in webhooks).
- **L3.** `.eslintrc.json` is just `next/core-web-vitals`. Add `no-console` (warn, with `allow: ["warn", "error"]`), `no-restricted-imports` to keep service-role client out of `'use client'` files, and `@typescript-eslint/no-explicit-any` (warn).
- **L4.** `vercel.json` has only the two cron entries. No `functions.maxDuration`. The image-triage AI routes (`api/admin/image-triage/strip-bg`, `match`) call Replicate/Claude synchronously — Vercel default 10s will time out on slow runs. Either (a) bump `maxDuration` for those routes, or (b) move to a job table + polling pattern.
- **L5.** PWARegister never unregisters on signout. Cached shell + cached SW state can serve the wrong account briefly post-logout.
- **L6.** `images.remotePatterns` includes `images.unsplash.com` — looks like dev placeholder leftover. Remove if not used in prod.
- **L7.** Inbound SMS from an unknown phone is `console.warn`'d and dropped (`sms/inbound/route.ts:33`). README promises "inbound SMS lands in the thread." Stash these in a `sms_triage` table with `awaiting_match` status so the rep can attach them to a profile by hand.
- **L8.** `/api/health` is unauthenticated and reveals which integrations are configured (`hints.sms_disabled_fallback`, `hints.stripe_disabled`). Low risk but informative for a recon attacker — gate behind a header secret or limit to admin.
- **L9.** Standing-order biweekly loop `for (let offset = 0; offset <= limit; offset += step === 14 ? 1 : 1)` — the ternary always evaluates to `1`, so `step` is dead. Functionally correct (the inner `daysSince < 14 continue` enforces cadence), but the code reads like a half-written change.
- **L10.** Reorder cookie hydration in `cart/page.tsx` flashes empty cart then fills (Zustand `persist` already handles standard hydration cleanly — the *reorder* path is server-cookie-driven). Fine, just be aware.

---

## 🧪 Test debt

Strong: pure-function utilities (`cutoff`, `pricing`, two standing-order tests) — 52 assertions, all passing.

Missing — high-leverage tests to add next:

1. **Pricing across full matrix** — `loadPricingContext` + `priceForProduct` against (account override × price-list × tier × DTC × null-priced product × expired-window).
2. **Cart store mutations** — `add` (same product different variant = new line), `setQty(0)` removes, `bulkSet` preserves variantLabel + variantSku, schema-version-1 → 2 migration.
3. **Phone normalization** — 10/11-digit, +1 prefix, parens/dashes, invalid cc.
4. **IIF export** — escaping (tabs, newlines, quotes) + parent:child customer name + sum-to-zero invariant.
5. **Cron handler — standing orders** — secret-required path, idempotency on re-run within same day.
6. **Cron handler — reorder prompts** — opt-out check, "already has order" skip.
7. **Stripe webhook** — bad signature → 400; success → order updated; duplicate event id → no double update.
8. **Twilio inbound** — bad signature → 403 (in any env); unknown phone → 200 with no row insert; multi-account profile → correct routing.
9. **Auth callback** — `next=/dashboard` redirects there; `next=@evil.com` falls through to `/`.
10. **Impersonation** — start without admin → 403; unknown profileId → 400; cookie tampering → 403.

CI gate to require: `npm run lint && npm run typecheck && npm test` blocking on PR.

---

## ✅ Things that are right

- **Cart store** (`src/lib/cart/store.ts`) — schema versioned, migration that backfills new variant fields, variant-key-aware sameLine matching. Good.
- **Twilio webhook signature helper** uses `crypto.subtle` + `timingSafeEqual` correctly (`src/lib/twilio/client.ts:80`). The bug is only the `NODE_ENV` skip in the consumer.
- **Stripe webhook** verifies signature with `constructEvent` and returns 400 on bad sig — only the event-type coverage is thin.
- **RLS coverage** — every public table has `enable row level security` (`0002_rls.sql:15-32`), helper functions `is_admin()` / `my_account_id()` are stable + `security definer` with `set search_path`.
- **Pricing logic** — `resolvePrice` priority order matches README, rounds in cents, uses pre-loaded context to avoid N+1.
- **Server vs client boundaries** — Anthropic SDK and Replicate are confined to `src/app/api/admin/image-triage/*`, not pulled into client bundles.
- **Pre-commit Claude review** workflow exists and is wired up.
- **Typecheck/lint clean** with `strict: true` despite the `as any` workarounds (those still need to go).

---

## Suggested action order

1. **C1** (privilege escalation in trigger) — one-line migration. Ship today.
2. **C2** (cron secret bypass) — invert the `if`, two routes. Ship today.
3. **H4** (next + postcss CVEs) — patch bump + retest. Today / tomorrow.
4. **H3** (Twilio sig env gate) — one-line. Today.
5. **H2** (open redirect) — one-line. Today.
6. **H1** (impersonation cookie) — sign + validate target. ~1 day.
7. **H5** (timezone in cutoff/standing) — small lib + thread parameter. ~1-2 days.
8. **H8** (CI gate) — add a job, set branch protection. ~1 hour.
9. **M1, M2, M3** (RLS + multi-account drift) — one migration + handler updates. ~1 day.
10. **H7** (generated Supabase types → kill the 87 `as any`) — slow but high-payoff. ~2 days.

Then work through Mediums and add the test gaps (above).

---

## ⚠️ Migration reminder

**No new migrations were added by this audit.** If you act on the recommendations and add migrations to `supabase/migrations/`, remember to **apply them in Supabase via the SQL editor before testing locally**. Buyers will see crashes (or worse, the security holes will remain open) until they land in the project's database.
