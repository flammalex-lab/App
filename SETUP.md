# Getting this running so you can test

This is the shortest path from "fresh clone" to "clicking through the app."

## 1 · Create a Supabase project (5 min)

1. Go to [supabase.com](https://supabase.com/dashboard) → **New project** (the free tier is fine)
2. Pick a region near you. Wait for it to provision.
3. Copy three values from the project's **Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (⚠ server-only, never expose)

## 2 · Run the database setup (1 min)

In the Supabase **SQL Editor**, paste the entire contents of `supabase/setup.sql` and run it.

That single file bundles the three migrations plus the product seed. It creates every table, enum, trigger, RLS policy, the delivery zones, pickup locations, and ~25 starter products across beef, pork, eggs, dairy, and produce.

> If you'd rather run them piecewise (better for a production setup), run the files in `supabase/migrations/` in order: `0001_init.sql`, `0002_rls.sql`, `0003_seed_config.sql`, then `supabase/seed.sql`.

## 3 · Configure the app

```bash
cp .env.example .env.local
# edit .env.local and paste the three Supabase values
```

At a minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
ACCOUNTING_PROVIDER=iif
```

Optional (required only for the SMS flows and DTC card payments):

```env
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

Without Twilio, SMS sends fall back to `console.log` — the rest of the app still works end-to-end. You can test everything except actually receiving texts.

## 4 · Install and start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000/api/health](http://localhost:3000/api/health) — you should see `{ "healthy": true, ... }` with the row counts from your new database. If not, the response tells you what's missing.

## 5 · Create an admin account for yourself

1. Visit `/register` and sign up with your email + password. This creates a `dtc_customer` profile by default.
2. Back in the Supabase **SQL Editor**, promote yourself:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

3. Sign out, sign back in at `/login` on the **Admin — email** tab. You'll land on `/dashboard`.

## 6 · (Optional but recommended) Seed demo data

Creates two demo accounts, two buyers, populated order guides, a standing order, and sample activities — so you have something to click through without building it by hand.

```bash
npx tsx scripts/seed-demo.ts your-admin-email@example.com
```

It will:

- Promote that email to admin (safe if already done)
- Create "Mighty Quinn's — Lower East Side" (NYC Metro, Net 30) and "West Side Market" (Finger Lakes, volume tier, Net 15)
- Create one B2B buyer per account
- Seed each buyer's order guide with 8 items and par levels for Tuesday + Friday
- Create a weekly Tuesday+Friday standing order for Mighty Quinn's
- Log a sample_drop activity on each

## 7 · Test the golden path

As admin:

1. **Dashboard** — you'll see KPI cards (all zero until orders flow in) and the recent-orders list
2. **Accounts → Mighty Quinn's** — scroll down and click the buyer's **View as buyer** button
3. You're now on `/guide` **as** Hugh — the yellow banner at the top says "Admin view — acting as Hugh Mangum"
4. Adjust some quantities, hit **Add to cart**
5. Pick a delivery date, **Place order (bill to account)**
6. Click **Stop** in the yellow banner → you're back in admin
7. **Orders** → click the new order → change status to `confirmed` (if you have Twilio wired, the buyer gets an SMS)
8. **QuickBooks** → **Export 1 order** → you'll get an `.iif` file you can import into QBD

Other flows worth trying:

- **Standing orders → Run now** on "Tuesday + Friday usual" — materializes a draft order + SMS confirmation
- **Accounts → Mighty Quinn's → Edit guide** (on the buyer row) — curate their list with par levels
- **Weekly availability** — toggle any item off; it'll show "limited" in the catalog
- **Accounts → New** — create a fresh account from scratch, then **Invite buyer by SMS**
- **Import customers** — export a Customer Contact List from QuickBooks as CSV and drop it in
- **Messages** — the buyer-facing `/messages` page and the admin-facing `/admin/messages/[accountId]` are wired to Supabase Realtime and Twilio SMS bridge

## 8 · Deploying to Vercel (when you're ready to share a link)

1. Push this repo to GitHub
2. [vercel.com](https://vercel.com) → **Add new project** → import the repo
3. Paste the same env vars from `.env.local`
4. Also set `CRON_SECRET` to any random string — Vercel Cron will use it to authenticate the scheduled jobs defined in `vercel.json` (daily standing-order run + hourly reorder prompts)
5. After deploy, update Twilio's inbound webhook to `https://<your-domain>/api/sms/inbound`
6. In Supabase **Auth → URL Configuration**, set `Site URL` to your Vercel domain

## Notes on testing the phone-OTP buyer sign-in

Phone OTP requires Supabase Auth → Providers → **Phone** to be enabled, which in turn requires a Twilio (or Vonage / MessageBird) account configured at the Supabase level. If you haven't set that up yet, use **View as buyer** (step 7 above) to test buyer flows — no OTP needed.

## If something goes wrong

- `/api/health` is your first stop — it confirms env vars and DB connectivity
- Check the Supabase **Logs → Postgres** panel for trigger failures (most common when the one-paste migration fails partway; re-run, it's idempotent-ish)
- Dev server errors surface as a full-screen error overlay; prod errors land in the browser console + `/error.tsx` boundary
