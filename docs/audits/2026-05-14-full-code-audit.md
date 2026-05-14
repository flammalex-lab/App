# FLF Portal — Full Code Audit

> **Snapshot — not maintained.** Captured 2026-05-14 on branch `claude/full-code-audit-Qw2TK`. File:line cites reflect the state of the branch at that moment. Future findings should be tracked as new dated files in `docs/audits/` rather than mutating this one.

**Date:** 2026-05-14
**Branch:** `claude/full-code-audit-Qw2TK`
**Method:** Seven specialized agents run in parallel — security, database/Supabase, frontend/UI, API/server, performance, code quality, dependencies/build. Findings de-duplicated and re-ranked here.
**Scope:** all of `src/`, `supabase/migrations/`, plus build/CI/config.

---

## Executive summary

The codebase is in solid shape since the 2026-05-09 audit. Most critical items from that report have been closed. The remaining risk is concentrated in three areas:

1. **Trust boundaries on admin & webhook endpoints** — CSRF/origin checks exist on `impersonate/start` but were never propagated to the other admin POSTs; Stripe webhook trusts client-supplied `metadata.order_id`; PostgREST filter injection on `/api/products/scan`.
2. **Failure modes in async pipelines** — standing-order runner silently swallows partial failures; cron observability can lose the failure row; orders/create serializes Twilio+Resend+DB in one request budget; `runStandingOrder` return value is discarded by `/run-now`.
3. **Migration & RLS gaps** — duplicate-numbered migrations (`0020_*`, `0022_*`); `activities`, `messages`, and `notifications` policies missing rows that the buyer-facing UI assumes; multi-account scope inconsistency.

Everything else is meaningful but not on the path that breaks the app or leaks data this week.

---

## Top findings, ranked

### CRITICAL — fix before next deploy

| ID | Where | What |
|---|---|---|
| **C1** | `src/app/api/products/scan/route.ts:40` | PostgREST filter injection: user-supplied `code` is interpolated raw into `.or(\`upc.ilike.${code},sku.ilike.${code}\`)`. A `code=foo,id.eq.<uuid>` payload extends the filter; `code=*` wildcards. Whitelist `^[A-Za-z0-9-]+$` or escape. |
| **C2** | every admin POST/PATCH/DELETE except `/api/admin/impersonate/start` | No same-origin check. `originOk()` exists in `impersonate/start/route.ts` but is not shared. A cross-site `<form method=post>` carries the admin's `sameSite=lax` Supabase cookie. Extract `requireSameOrigin()` and call at top of every state-changing route. |
| **C3** | `src/app/api/stripe/webhook/route.ts:81-89, 200-220` | Verified-Stripe-signature **does not** verify that `metadata.order_id` belongs to the matching PaymentIntent. Look up the order by stored `stripe_payment_id` instead, or assert `orders.stripe_payment_id === session.payment_intent` before update. |
| **C4** | `src/lib/standing-orders/run.ts:42-66` | After `orders.insert` succeeds, neither `order_items.insert` nor `standing_orders.update({last_run_date})` errors are checked. An orphaned header + advanced last-run-date is the worst possible state: buyer sees nothing, cron skips the next cycle. Surface errors and either compensate (delete header) or return `{ok:false}`. |
| **C5** | `src/app/api/standing/[id]/run-now/route.ts:17` | The `{ok, error}` from `runStandingOrder` is discarded. Buyer-triggered run-now silently appears to succeed even on failure. Translate to a query param on the redirect or return 500 JSON. |

### HIGH — fix this sprint

| ID | Where | What |
|---|---|---|
| **H1** | `supabase/migrations/0020_*.sql`, `0022_*.sql` | Two pairs of duplicate migration numbers. Supabase CLI alphabetises within a number, so `_consolidate_meat_categories` runs before `_security_hardening`. Fresh installs vs. existing installs can diverge. Rename to `0020a/0020b` and squash the 0020-0023 category churn into one coherent migration. |
| **H2** | `src/app/api/admin/signin-link/route.ts:61-65` | Admin endpoint returns a 1-hour passwordless URL for any user (no admin-target guard, no audit log). Combine with C2 and a CSRF gives an attacker a sign-in link for any account. Forbid `role='admin'` targets, write an audit row, require same-origin. |
| **H3** | `src/app/api/admin/products/[id]/route.ts:10-18`, `src/app/api/admin/accounts/[id]/route.ts:7-17` | Raw `await req.json()` is spread into `.insert/.update`. A typo'd `id` field can corrupt rows. Allow-list columns (mirror what `image-csv/import/route.ts` already does). |
| **H4** | `src/app/api/orders/create/route.ts:259-302`, `src/app/api/admin/orders/[id]/update/route.ts:62-99` | Notifications dispatched as sequential `await`s inside the request. Slow Twilio/Resend can blow the Vercel 10s budget after `orders.insert` succeeds → duplicate submits. Use `waitUntil()` / `Promise.allSettled` and accept that delivery is best-effort. |
| **H5** | `src/app/api/stripe/webhook/route.ts:241-249` | Checkout session creation is awaited **after** the order is inserted and a system message is posted to the account thread. If Stripe throws, you've already polluted state. Create the Stripe session first, store `stripe_payment_id`, then insert the order. |
| **H6** | `src/app/api/orders/create/route.ts:65-78` | Re-fetches products without `private`, `is_active`, `available_b2b/dtc`, `available_this_week`. The amend route honors these gates; create does not. A buyer can POST a cart referencing an inactive/private/wrong-channel product. |
| **H7** | RLS — `activities` table (`supabase/migrations/0001_init.sql:272`, policies in `0002_rls.sql:109`) | Only `is_admin()` policy. Buyers reading/inserting their own activities get zero rows. Either the feature is silently broken or the app uses service-role everywhere (foot-gun). Add member-read + self-insert policies. |
| **H8** | RLS — `notifications`, `messages` (`0002_rls.sql:120`, `0014_messages_nullable_account.sql`) | Both scope by `auth.uid()` / `my_account_id()` (the buyer's **default** account) instead of `profile_accounts` membership. Multi-account buyers lose notifications/messages when they switch accounts. Mirror the `0020_security_hardening` standing-orders pattern. |
| **H9** | `src/lib/cron/observability.ts:20-25` | If `cron_runs.insert` fails, `runId` is null and the failure-recording branch is skipped — so a 5-minute job can run with zero observability. Log the insert error and consider failing fast. |
| **H10** | `src/app/sw.js/route.ts:75-84` | Service worker `NEVER_CACHE` list is opt-out, not opt-in. Any future buyer-scoped route added without the prefix can be cached and leak across sessions on a shared device. Drop HTML caching entirely; cache only `/_next/static/*` and image assets. |
| **H11** | `src/app/(storefront)/layout.tsx:28,42` | `createServiceClient()` (service-role) is used on every storefront request, not just the impersonation branch. Service-role bypasses RLS; any future widening of these queries leaks. Use `createClient()` for the non-impersonation path. |
| **H12** | `src/components/ui/BottomSheet.tsx:210-268` | `role="dialog" aria-modal="true"` but no focus trap, no initial focus, no return-focus. Every consumer (cart Remove-all, variant picker, delivery picker, MobileHeader overflow) is keyboard/screen-reader broken. |
| **H13** | `src/lib/cart/store.ts:269` persist key `"flf-cart"` | Buyer cart persisted to `localStorage` under a fixed key, not scoped by user. Shared device → next buyer hydrates the previous buyer's cart. Sign-out clears the SW caches but not localStorage. Scope key by user id or clear on sign-out. |
| **H14** | `src/lib/supabase/server.ts:39-45` | Service client returns untyped `any` (uses `require()` runtime trick, defeats `SupabaseClient<Database>` inference). Propagates 60+ `as any` casts. Run `supabase gen types typescript` (the codebase already plans for this) and switch to a static import. |

### MEDIUM

| ID | Where | What |
|---|---|---|
| **M1** | `src/lib/notifications/dispatch.ts:115-125` | `smsAllowedToday` race: two concurrent dispatches both read count<limit and both send. Move daily cap to a Postgres row-locked counter or upsert with `on conflict do update`. |
| **M2** | `src/lib/cart/store.ts:179` `subtotal()` | No `Number.isFinite` guard. A v1/v2 cart line hydrated without `unitPrice` makes the whole subtotal NaN — silently propagates to the displayed total. |
| **M3** | `src/app/api/auth/sms-consent/route.ts:33-44` | Setting `opt_in:false` nulls `sms_opt_in_source` and `sms_opt_in_at`, destroying the audit trail TCR disputes rely on. Add `sms_opt_out_at` and keep history. |
| **M4** | `src/app/api/orders/reorder/route.ts:44-49` | Cart payload serialized into a cookie. Long history → exceeds 4KB cookie limit → silent truncation or session breakage. Persist to a `pending_reorders` row, set only the id. |
| **M5** | `src/app/api/cron/standing-orders/route.ts:28-50` and `/api/cron/reorder-prompts/route.ts:39-48` | Sequential `for...of` over accounts with per-row Twilio+Resend awaits. With 50+ accounts this hits the 300s `maxDuration`. Parallelize with a concurrency cap (e.g. p-limit at 5). |
| **M6** | `src/app/api/admin/messages/send/route.ts:20` | Admin outbound SMS calls `sendSms` directly, bypassing `enqueueAndSend` + daily cap + opt-in checks. Route through `dispatch.ts`. |
| **M7** | `src/lib/supabase/server.ts`, `src/lib/twilio/client.ts`, `src/lib/stripe/client.ts`, `src/lib/notifications/dispatch.ts` | None imports `"server-only"`. Today they're only used server-side, but nothing prevents a future client component from importing them and shipping the service-role key. Add the guard. |
| **M8** | Duplicated money/round helpers | `formatMoney`/`round2` are redefined locally in `src/app/api/orders/create/route.ts:307-308` and `.../amend/route.ts:359-364` instead of using `src/lib/utils/format.ts:money()`. The local versions render `$NaN` on undefined and skip locale grouping — email totals can disagree with the order page. Same story for `isoDateInTz` in `amend/route.ts:371` vs `src/lib/utils/timezone.ts`. |
| **M9** | `eslint.config.cjs:3` | Requires `eslint-plugin-react-hooks` but the package isn't declared in `package.json` — it resolves today only as a transitive of `eslint-config-next`. Add to `devDependencies` to make it explicit. |
| **M10** | `jest.config.js:11` | `{ tsconfig: { jsx: "preserve", ... } }` passed to `ts-jest` **replaces** the whole compilerOptions block at runtime (paths, target, strict, moduleResolution all silently dropped for tests). Reference the tsconfig **path**: `"tsconfig": "<rootDir>/tsconfig.json"`. |
| **M11** | `package.json` | React 18.3.1 paired with Next 16. Next 16 supports React 18 but recent commits and eslint config comment "React 19 + Next 16 follow-ups" — the upgrade is half-finished. Either commit to React 19 or back out the React-19-only hook rules. |
| **M12** | `package.json` | `@capacitor/android` and `@capacitor/ios` belong in `devDependencies` — Vercel never installs/uses them. Move to slim prod install. |
| **M13** | `.github/workflows/ci.yml` | Runs lint+typecheck+test but no `next build`. Typecheck does not catch build-only failures (image config, route conventions, edge runtime). Add a build job and pin `engines: { node: ">=20 <23" }` + `.nvmrc`. |
| **M14** | `src/lib/cart/store.ts` (296 LOC) | No unit tests. Subtotal/rhythm/variant-keyed merge is the most user-visible code in the app and the conspicuous gap in `tests/`. Add `tests/cart-store.test.ts` covering `addLine` merge-by-`(productId, variantKey)`, `setQty(0)` skip semantics, `subtotal` under `priceByWeight=true`. |
| **M15** | RLS — `order_items` | `0002_rls.sql:90-96` covers admin-all + owner-read + owner-insert but no owner-delete/update. A buyer cancelling a draft order can't remove its line items via RLS. |
| **M16** | RLS — `messages` UPDATE | Only `messages admin all` covers UPDATE. Buyer can't mark their own messages as read. |
| **M17** | Indexes — `orders.placed_by_id` (`0001_init.sql:200`) | FK with no index. Admin "orders submitted by rep X" → seq scan. Add `create index idx_orders_placed_by on orders(placed_by_id) where placed_by_id is not null;` |
| **M18** | Indexes — `products.upc` (`0015:15`) | Index is on raw `upc` but barcode scan does case-insensitive lookups. Add `create index idx_products_upc_lower on products(lower(upc)) where upc is not null;` |
| **M19** | Indexes — `accounts.enabled_categories` | No GIN index. `@> ARRAY[?]` predicates seq-scan. `create index ... using gin(enabled_categories);` |
| **M20** | Perf — `src/app/(storefront)/layout.tsx:22-50` | Five+ Supabase round-trips per storefront navigation (session → impersonation → profile → resolveActiveAccount → `delivery_zones.*`). None deduped. Wrap `delivery_zones` in `unstable_cache`; wrap the impersonation profile read in React `cache()`. |
| **M21** | Perf — `src/app/(storefront)/guide/page.tsx:308-312`, `catalog/page.tsx:393-396` | Two unbounded `order_items` aggregate scans (no `.limit()`, no time bound). Add `.gte("created_at", 90daysAgo)` or move to a materialized view. |
| **M22** | Perf — `public/images/flf-logo.png` (672KB) | Used as 1024px favicon + apple-touch + push icon. Shipped on every page via `metadata.icons`. Generate 180/152/120 PNG/WebP set. |
| **M23** | Perf — `src/app/(storefront)/catalog/page.tsx:207` | Hero `<img>` instead of `next/image`, no `priority`, no responsive `srcset`. Easy LCP win. |
| **M24** | Open redirects | `src/app/login/actions.ts:14` redirects to `next || "/dashboard"` without `safeRedirectTarget`. Same for `LoginClient.tsx:79`. Wrap. |

### LOW (worth doing, low blast radius)

- **L1** CSP still ships `script-src 'unsafe-inline'` (`next.config.js:51`) — already TODO'd in the file. Move to nonce-based.
- **L2** `setActiveAccountCookie` is `sameSite=lax`; `setImpersonation` is `sameSite=strict`. Inconsistency. CSRF risk is mostly closed by C2 + same-origin, but use strict on both.
- **L3** `src/app/api/admin/qb/export/route.ts:72-75` marks orders `qb_exported=true` before the file is delivered. If the client drops, the export is "consumed" with no file in hand.
- **L4** `src/app/api/admin/items/import/route.ts:78-141` updates products sequentially. A 500-row CSV blocks; use `Promise.allSettled` with a concurrency cap.
- **L5** `src/app/api/cart/consume-reorder/route.ts:8` is anonymous. Low impact but should require a session.
- **L6** `src/app/api/health/route.ts` falls back to `CRON_SECRET` when `HEALTH_TOKEN` is unset (already noted in `.env.example`). Set `HEALTH_TOKEN` separately in prod.
- **L7** `alert()` used for failure UX in `MobileHeader.tsx:311`, `AccountSwitcher.tsx:53`, `ChatClient.tsx:182`. Use the existing `useToast()`.
- **L8** `LineItem.tsx:175-194` qty buttons are `h-9 w-9` (36px) — below iOS 44pt minimum. CartClient/ProductCard already use `h-11`. Raise here.
- **L9** `<img>` hero on catalog (covered in M23), plus the BarcodeScanner cart list at line 355 — swap to `next/image`.
- **L10** `crypto.randomUUID()` in `Toast.tsx:22` without fallback. Older iOS may need a polyfill if Capacitor targets ≤ iOS 15.
- **L11** Soft-delete column inconsistency across tables (`accounts.status='inactive'`, `products.is_active=false`, `pickup_locations.active=false`, `price_lists.active=true`). Pick one convention.
- **L12** `stripe_events.received_at` not indexed — a janitor job pruning old events will seq-scan.
- **L13** `0027_tighten_advisor_warnings` revokes `is_admin/my_account_id` EXECUTE; `0028_restore_rls_helper_execute` re-grants. Squash before next replay.
- **L14** Hardcoded placeholder `tel:+16071234567` in `StickyCartBar.tsx:118` — pull from `account.rep_phone` or env.
- **L15** Top-LOC god-files (worth splitting next time you touch them): `(storefront)/catalog/page.tsx` 647 · `admin/image-triage/ImageTriageClient.tsx` 645 · `cart/CartClient.tsx` 631 · `(storefront)/guide/page.tsx` 607 · `products/ProductCard.tsx` 571 · `chat/ChatClient.tsx` 558.
- **L16** `jest.config.js` `testMatch` pattern is `**/*.test.ts` — future `.test.tsx` React component tests will be silently skipped.

---

## What's healthy (worth preserving)

- Stripe webhook dedupe via `stripe_events.id` UNIQUE + `23505` catch is well-thought-out.
- Cron auth uses `constantTimeEquals` and mandatory `CRON_SECRET` — correct.
- Impersonation cookie HMAC build/verify with `timingSafeEqual` is solid.
- Twilio inbound signature validation rejects unsigned in prod despite the env escape hatch — good defense in depth.
- variantKey / variantSku / priceByWeight naming is honored consistently across the cart → order API boundary (CLAUDE.md "sacred fields" rule).
- Test coverage on the highest-risk surfaces (Stripe webhook, standing-order runner, cron auth, impersonation, safe-redirect, IIF export, pricing tiers) is strong. Cart math is the gap.
- BarcodeScanner is dynamic-imported (zxing kept off initial bundle) — keep it that way.
- `accounting/` module boundary (provider abstraction, single import surface) is the right pattern. Replicate for `notifications/` and `twilio/`.
- Zero TODO/FIXME/HACK markers across `src/` — comment quality is high.

---

## Suggested order of operations

1. **C1, C2, C3** in one PR (security trust-boundary). Add `requireSameOrigin()` helper, fix scan filter, fix Stripe metadata trust. Tests for each.
2. **C4, C5, H9** in one PR (standing-order observability + error propagation). Add cart-store unit tests (M14) at the same time — same area of code.
3. **H1** as its own PR (migration rename + squash). High coordination cost; do it standalone.
4. **H7, H8, M15, M16** as one RLS-coverage PR.
5. **H10, H11, H12, H13** as a frontend-trust PR.
6. **M5, M21, M22, M23** as a perf PR — all small, all visible.

> ⚠ **Migration reminder:** none of the SQL fixes above will land until the migration is applied in Supabase. The recommended H1 fix (rename + squash 0020–0023) is itself a migration; treat that as the marker.
