# Notes for Claude

## Project context

- Next.js 14 App Router · Supabase (Postgres + RLS + Realtime) · Tailwind ·
  Twilio (phone OTP + SMS bridge) · Stripe (DTC) · Vercel + Cron.
- This is a B2B-first ordering portal for Fingerlakes Farms with a smaller
  DTC surface. See `README.md` for the full architecture map.

## Workflow rules

### Always flag Supabase migrations
Whenever a change adds or alters a SQL migration in `supabase/migrations/`,
**explicitly remind Alex to apply the migration in Supabase before testing**.
Format the reminder as a clear callout at the end of the response, listing
the migration filename(s) to run. Buyers won't see new features (and pages
may crash) until the migration lands in the project's database.

### Local dev quirks
- The app is a PWA — service worker can serve stale code on hard reload.
  When debugging "I don't see the changes," tell Alex to:
  1. Confirm the right git branch (`git branch`).
  2. `pkill -f "next dev"` then `npm run dev` (port 3000 is often held
     by an old process that runs the *old* code).
  3. Hard reload + DevTools → Application → Service Workers → Unregister
     + Clear site data.

### Branch hygiene
Default working branch for this engagement: `claude/get-up-to-date-Xi8vI`.
Alex sometimes pushes screenshots/assets to `claude/fingerlakes-farms-portal-SZY1w`
by accident — pull those commits over via `git checkout <sha> -- public/images/pepper/`
when needed.

### Don't ask permission, just do it
Alex hates approval-gate questions ("OK to run X?", "Should I commit?",
"Want me to push?"). Just do the thing — including destructive git ops
like `git reset --hard`, `git checkout --`, branch deletion, etc. — when
it's the obvious next step to keep the project moving. If you genuinely
hit something risky and ambiguous (data loss across unrelated work,
deleting something you didn't create, force-pushing over someone else's
commits), surface it; otherwise act. This overrides the default
"confirm before destructive ops" rule.

### Self-review, then ship to main directly
Production deploys from `main` on Vercel. Alex trusts you to be the coder
*and* the reviewer — ship routine work directly to `main` without
prompting or asking for a "go ahead."

The flow:
1. Make changes (on `main` if the harness allows, otherwise on the
   harness-assigned working branch) and commit.
2. Self-review the diff — re-read what you changed, check for obvious
   bugs/regressions, confirm tests/typecheck still pass when relevant.
   If something feels risky or ambiguous, surface it in chat *before*
   shipping instead of asking permission for routine work.
3. Push to `main`. If the harness blocks direct pushes to `main` (some
   sessions assign a `claude/*` branch and require pushing there), fall
   back to: push the branch, open a PR with
   `mcp__github__create_pull_request`, then immediately merge it with
   `mcp__github__merge_pull_request` (squash). Either way, do **not**
   wait for Alex to review or approve — shipping is the ship action.
4. **Never** run `/review`, `/ultrareview`, `request_copilot_review`, or
   any other Claude/Copilot review API — those charge credits Alex
   doesn't want spent. The CI workflow runs lint + typecheck + tests
   (free) and that's the entire automated gate.
5. Mention what shipped (and the PR number, if a PR was needed) in your
   end-of-turn summary.

Open a PR *without* immediately merging only when Alex explicitly asks
for review on a specific change before it lands.

### Style
- FLF brand: editorial / farm-forward, not Shopify-corporate. Display font
  Bricolage Grotesque, brand-blue + accent-rust + accent-gold + brand-green
  palette (see `tailwind.config.ts`). Tone: "Trust our process. Trust your food."
- Emoji only when the user explicitly opts in.

### What NOT to do
- Don't introduce promo codes, "you might also like" recs, status timelines,
  or "Pay Now" CTAs unless asked — Alex has explicitly deferred these.
- Don't break the existing cart's variant fields (`variantKey`, `variantSku`,
  `priceByWeight`) when adding new flows.
