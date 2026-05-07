# Fingerlakes Farms Portal

PWA-ready ordering portal for Fingerlakes Farms — B2B wholesale (restaurants,
grocery, institutional), direct-to-consumer beef (Flamm to Table), and
distributor / carrier services.

**Sub-brands:** Grasslands (beef), Meadow Creek (eggs), Fingerlakes Farms
(produce, dairy, carrier services). Chicken program suspended as of March 2026.

## Stack

- **Next.js 14** (App Router, RSC, route groups)
- **Tailwind CSS** — editorial / farm-forward look
- **Supabase** — Postgres, phone OTP + email auth, Row Level Security, Realtime
- **Stripe** — DTC checkout; B2B orders are billed via QuickBooks invoice
- **Twilio** — phone OTP, outbound SMS, inbound SMS webhook for messaging
- **Vercel** — hosting + Cron (standing orders + reorder nudges)

## Design philosophy (Choco / Pepper, not Shopify)

- **Order guide first.** The buyer lands on their saved list, not the catalog. "Same as last time" is one tap.
- **Cutoff clock** on every page — buyer always knows when the next delivery is and how long until the door shuts.
- **Par levels per day-of-week** seed the guide (`{"tue": 6, "fri": 12}`).
- **Rep places orders for buyers** via admin "view as buyer" impersonation.
- **Messaging bridges SMS.** Outbound from the app lands in the buyer's texts. Inbound SMS lands in the thread.
- **Phone auth, no password.** Admin seeds the profile; buyer types their phone, gets an OTP, signs in. Zero-friction onboarding.

## Quick start

```bash
cp .env.example .env.local
# fill in Supabase + Twilio + Stripe keys
npm install
npm run dev
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed_config.sql`
3. Run `supabase/seed.sql` for a starter product catalog.
4. In **Auth → Providers**, enable Phone (Twilio), and in **Settings → Auth**,
   set `Site URL` to your deployed domain and add `/auth/callback` to redirect URLs.
5. Promote your own account to admin:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```

### Environment variables

See `.env.example`. Required for launch:

| Scope | Vars |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` |
| Stripe (DTC) | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| App | `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` |
| QB | `ACCOUNTING_PROVIDER=iif` for launch; flip to `conductor` in Phase 2 |

### Twilio inbound SMS webhook

In Twilio Console → Messaging → configure your number (or Messaging Service)
so inbound messages POST to:

```
https://<your-domain>/api/sms/inbound
```

The portal matches the sender's phone to a profile and lands the message in
the buyer↔rep thread. Replies the rep sends go out as SMS too.

## App surface

### Buyer (B2B)
- `/guide` — primary UX, curated list with par levels, one-tap reorder
- `/catalog` — filtered by `accounts.enabled_categories` (meat / dairy / produce subset)
- `/cart` — delivery date, notes, minimum enforcement
- `/orders` — history + status
- `/standing` — recurring orders, SMS confirmation before auto-submit
- `/messages` — threaded chat with rep, SMS-bridged
- `/account` — profile, tier, delivery zone

### Buyer (DTC)
- `/catalog` — retail-available items only
- `/cart` — pickup location + date + Stripe checkout
- `/orders`, `/account`

### Admin (`/dashboard` etc.)
- Dashboard — KPIs, pending orders, QB export queue, revenue MTD
- Orders — list/filter, detail, status transitions trigger SMS
- Products — CRUD + weekly availability toggle page
- Accounts — list, CRUD, buyer invitation by SMS, impersonation ("view as buyer")
- Pricing — account-specific overrides
- Standing orders — all accounts' recurring orders
- Messages — threaded inbox, SMS-bridged
- QuickBooks — IIF/CSV export of unexported orders, mapping alerts
- Import customers — one-time CSV upload from a QuickBooks Customer Contact List
- Settings — QB income-account mapping, delivery zones, pickup locations

## Architecture notes

### Pricing resolution (server-side, never client-only)

```
account_pricing.custom_price   (account override, within effective window)
    ↓ falls back to
products.wholesale_price × tier multiplier   (B2B only; tier from account)
    ↓ falls back to
products.retail_price   (DTC)
    ↓ else
null — admin must price before ordering
```

Tier multipliers (fixed, not data-driven per your direction):
- `standard` = 1.0× · `volume` = 0.92× · `custom` = per-item override required

### Accounting service abstraction

Everything QuickBooks-related goes through `src/lib/accounting/`.
`getAccountingService()` returns the impl selected by `ACCOUNTING_PROVIDER`:

- **Phase 1** (`iif`) — batch-export an IIF file; admin imports into QBD
- **Phase 2** (`conductor`) — live sync via Conductor (stubbed; swap on ready)

No app code outside `src/lib/accounting/` imports a specific provider.

### Multi-location chains

Accounts are self-referential via `parent_account_id`. Use null for single-site
accounts; chain children point to the parent. The IIF exporter emits
`Parent:Child` format for QB's Customer:Job convention when a parent exists.

### Admin "view as buyer"

`POST /api/admin/impersonate/start?profileId=…` sets an HTTP-only cookie.
Server components load the effective profile + account via `getImpersonation()`,
querying with the service role to bypass RLS under explicit admin control.
Every start/stop is written to `admin_impersonation_log`.

### Standing orders + cutoff logic

- `src/lib/utils/cutoff.ts` — from zone rules (`delivery_days`, `cutoff_hours`) compute the next deliverable date. Drives the CutoffClock and the reorder-prompt cron.
- `src/lib/utils/standing-order.ts` — from frequency + days_of_week, compute next run date.
- `src/lib/standing-orders/run.ts` — materialize a standing order into a draft order and SMS the buyer to confirm.

### Cron

`vercel.json` schedules:

- `/api/cron/standing-orders` — daily 10:00 UTC
- `/api/cron/reorder-prompts` — hourly (sends SMS nudge when cutoff < 6h away and no order has been placed)

Both verify `Authorization: Bearer ${CRON_SECRET}` before running.

## Build phases

### Phase 1 — MVP (this code)
- [x] Supabase schema + RLS + seed
- [x] Phone OTP auth (buyers) + email auth (admin)
- [x] Order-guide landing, catalog, product detail, cart, checkout
- [x] Role-aware pricing (B2B tiers + account overrides)
- [x] B2B invoice orders, DTC Stripe checkout, Venmo manual option
- [x] Admin dashboard + orders + products CRUD + accounts
- [x] Standing orders + SMS confirmation
- [x] Messaging (buyer↔rep) with Twilio SMS bridge
- [x] Reorder-prompt cron
- [x] Admin "view as buyer" impersonation with audit log
- [x] QuickBooks IIF/CSV export + settings
- [x] One-time QB customer CSV import
- [x] Weekly availability toggle
- [x] PWA manifest + service worker + push scaffolding

### Phase 2
- [ ] Conductor live sync for QuickBooks
- [ ] Web Push subscription flow + server-side sending
- [ ] PDF order guide export for chefs
- [ ] Bundles / promo flags
- [ ] Analytics dashboard (revenue by account/channel, cadence alerts)
- [ ] Broadcast messaging (promote seasonal items to a segment)
- [ ] Delivery route planning

## Directory map

```
src/
  app/
    (admin)/           admin dashboard + pages
    (storefront)/      buyer pages
    api/               REST endpoints + webhooks + cron
    login/ register/ auth/
  components/          ui primitives, nav, cutoff clock
  lib/
    accounting/        QB abstraction (IIF + Conductor stub + builder)
    auth/              session + impersonation helpers
    cart/              client-side cart store (zustand)
    notifications/     dispatch (SMS/push/email)
    standing-orders/   run logic
    stripe/ twilio/ supabase/
    utils/             cn, phone, format, pricing, cutoff, standing-order
supabase/
  migrations/          0001 init · 0002 RLS · 0003 seed config
  seed.sql             starter product catalog
```

## License

Proprietary — Fingerlakes Farms / ilovenyfarms.com
