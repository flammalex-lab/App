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

### Review locally, then merge straight to `main`
Production deploys from `main` on Vercel. Skip the PR/GitHub-review loop —
Alex doesn't want credits spent on cloud reviews or time spent bouncing
through the GitHub UI.

Instead:
1. Make changes on the working branch and commit locally.
2. Walk Alex through the diff in chat (`git diff`, file:line refs) so he
   can review in the terminal.
3. **Wait for an explicit go-ahead** ("ship it", "merge it", "push to main",
   etc.) before touching `main`.
4. On approval: fast-forward or squash-merge the working branch into `main`
   locally, then `git push -u origin main`. Don't open a PR, don't run
   `/review` or `/ultrareview`, don't request a Copilot review.

If Alex explicitly asks for a PR for a specific change, open one — but
that's opt-in now, not the default.

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
