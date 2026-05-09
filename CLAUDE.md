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

### Self-review, then merge straight to `main`
Production deploys from `main` on Vercel. Skip the PR/GitHub-review loop —
no cloud reviews, no Copilot review, no `/review` or `/ultrareview`, no
bouncing through the GitHub UI. Alex trusts you to be the coder *and* the
reviewer; you don't need an explicit "go ahead" before merging.

The flow is:
1. Make changes on a working branch and commit.
2. Self-review the diff before merging — re-read what you changed, check
   for obvious bugs/regressions, confirm tests/typecheck still pass when
   relevant. If something feels risky or ambiguous, surface it in chat
   *before* merging instead of asking permission for routine work.
3. Fast-forward or squash-merge the working branch into `main` locally,
   then `git push -u origin main`. Keep the project moving.
4. Mention what you merged in your end-of-turn summary so Alex can see
   what shipped.

Open a PR only when Alex explicitly asks for one for a specific change.

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
