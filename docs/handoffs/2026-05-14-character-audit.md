# FLF — Character audit handoff

> **For Claude design (or whoever's making design calls).** Engineering-side audits scored every buyer-facing surface for "where can character go." This document is the artifact to act on. Decisions left to design judgment — *don't* re-derive the inventory, *do* pick what to ship.

**Date:** 2026-05-14
**Source:** desktop Playwright audit on `rhythm-demo@ilovenyfarms.com` against production HEAD `814695c`
**Method:** 3 passes — (1) screenshot every distinct buyer state at mobile 390 + desktop 1440, (2) score each on emotional weight × current character → gap, (3) bucket into ship-now / restrained / don't-touch.

---

## Framework

Two axes, 0–3 each:

**Emotional weight** = how much the buyer cares about this moment.
0 = utility (price-list-style) · 1 = transactional · 2 = meaningful · 3 = celebration / first-impression

**Current character** = how much brand voice is already on screen.
0 = text + UI chrome only · 1 = a logo or one icon · 2 = one branded element · 3 = richly composed

**Gap = weight − character.** Targets are gap ≥ 2. Skip gap = 0 cells (utility screens stay clean — over-decorating makes them feel slow).

---

## Scored inventory (24 screens)

### Mobile

| Screen | Weight | Character | Gap |
|---|---:|---:|---:|
| login | 3 | 1 (logo + headline) | **3** |
| /guide top (rhythm draft) | 3 | 1 (date strip) | **3** |
| /guide rows | 2 | 0 | 2 |
| /catalog landing (cow hero) | 3 | 2 | 1 |
| /catalog rail | 2 | 1 (product photos) | 1 |
| PDP modal | 2 | 1 | 1 |
| /cart | 2 | 0 | 2 |
| /cart/review | 2 | 0 | 2 |
| /orders/[id] | 2 | 0 | 2 |
| /orders past | 1 | 0 | 0 |
| /orders upcoming empty | 2 | 0 | 2 |
| /standing list | 2 | 0 | 2 |
| /standing empty | 1 | 0 | 0 |
| /producer/[slug] (when shipped) | 3 | 1 | **3** |
| /chat | 2 | 1 (rep avatar) | 1 |
| /account | 1 | 1 (avatar) | 0 |
| 3-dot overflow sheet | 1 | 0 | 0 |
| **SubmitSheet → "order placed" moment** | 3 | 0 | **3** |

### Desktop (delta only)

| Screen | Weight | Character | Gap |
|---|---:|---:|---:|
| /guide 1440 | 3 | 0 (lots of whitespace) | **3** |
| /catalog 1440 | 3 | 2 (cow hero) | 1 |
| /cart 1440 | 2 | 0 | 2 |
| /orders 1440 | 2 | 0 | 2 |
| /standing 1440 | 2 | 0 | 2 |
| /chat 1440 | 2 | 1 | 1 |

**Screenshots** for all 24 live on the desktop machine that ran the audit at `~/code/App/.playwright-mcp/` (named `char-01-...` through `char-24-...`). Ask Alex if you need them — not in the repo because they're heavy and ephemeral.

---

## Engineering-side caveats (per ship-candidate)

### Order-placed moment (gap 3, highest emotional weight)
- **File:** `src/app/(storefront)/orders/[id]/OrderPlacedHero.tsx` (~120 LOC)
- **Where it renders:** `/orders/[id]?placed=1` — the buyer lands here right after Submit
- **Today:** opaque card with `Estimated total` + a "Want to make this a regular order?" prompt added in PR #115
- **Mutable shape:** the whole component is mutable. Existing props: `order`, `account`, `lines`. Add new ones freely.
- **What I'd push back on:** keep the standing-order prompt — it's a real conversion surface. Layer character around it, not replace it.

### Bottom-nav icons (gap moderate, every-screen frequency)
- **File:** `src/components/layout/BottomTabs.tsx` + the 4 icon components inside `src/components/layout/StoreNav.tsx` lines 124-156 (`GuideIcon`, `CatalogIcon`, `OrdersIcon`, `ChatIcon`)
- **Today:** Lucide-style stroke icons, currentColor, 24×24
- **Mutable shape:** SVG paths inside small inline components. Swap path data freely. Keep `currentColor` so brand-blue active state works.
- **Risk:** every buyer sees these 100x/month. Bad icons everywhere is worse than competent generic. **Don't ship custom unless the artwork is genuinely good.**

### /guide top
- **File:** `src/app/(storefront)/guide/GuideClient.tsx` lines ~275-310 (header sub-line + submit pill landed in PR #141)
- **Today:** "8 lines · pulled from your last 4 Tuesdays · 0 edits" + brand-blue Submit pill below
- **Mutable shape:** the whole header block. Could add an eyebrow glyph, a thin landscape strip, a script flourish.
- **Don't touch:** the Submit pill placement or copy — that just landed and it's the highest-functional-leverage element on the screen.

### Empty states (gap 2 each)
- **/orders empty:** `src/app/(storefront)/orders/page.tsx` — currently uses a generic empty pattern with calendar icon
- **/standing empty:** `src/app/(storefront)/standing/page.tsx`
- **/cart empty:** rendered inside `src/app/(storefront)/cart/CartClient.tsx`
- All three currently use the same `<EmptyState>` shape. Could swap the icon prop for an `<Image>` prop without breaking callers.

### Section eyebrows on /guide
- **File:** `src/app/(storefront)/guide/DraftLine.tsx` + parent that groups by sub-category in `GuideClient.tsx`
- **Today:** uppercase text-only labels (`MILK`, `EGGS`, `GREENS`, etc.)
- **Mutable shape:** add a small leading glyph slot — either inline emoji, a Lucide set, or custom SVGs. Decide the bar (custom-only vs. start with a curated emoji set to test the idea).

### Producer pages (when they ship)
- **Status:** stub. Currently `/catalog?producer=X` filters to that producer's products but there's no `/producer/[slug]` route. Building it is engineering work + content (producer interviews, photos).
- Hold until producer content exists.

---

## Don't-touch list (these are gap 0; forcing character makes them worse)

- Cart line rows + qty steppers
- /orders past tab (tabular scan)
- /account page
- 3-dot overflow sheet
- Forms (login form, /standing/new form)
- Cart "Find in this cart" search

These are utility surfaces. Buyers in those moments want speed, not warmth.

---

## Existing brand assets (free to use)

- **Fonts:** Bricolage Grotesque (display) + Inter (body) — already loaded in `src/app/layout.tsx`
- **Palette:** `tailwind.config.ts` — brand-blue `#1763B5`, brand-green `#2A9B46`, accent-rust, accent-gold
- **Photos:** `.claude/skills/fingerlakes-farms-design/assets/photos/`
  - `cow-jersey.jpg`, `chicken-1.jpg`, `equipment-1.jpg`, `equipment-2.jpg`
  - `farm-1.jpg` through `farm-4.jpg`, `landscape-1.jpg`, `landscape-2.jpg`
  - `produce-1.jpg`, `produce-2.jpg`
  - Plus `farm-cow-hero.jpg` at the asset root
- **Design system docs:** `docs/design-system.md` + `.claude/skills/fingerlakes-farms-design/SKILL.md`

Use the existing photos before commissioning new artwork. The order-placed moment in particular could use `landscape-1.jpg` or `farm-2.jpg` as a hero behind the Bricolage headline without any new content.

---

## Recommended order of attack (engineering POV)

Cheapest → costliest. Design picks the actual order.

1. **Order-placed copy + typography refresh** — code only, uses existing photo, half a day. Highest immediate emotional payoff, lowest variance. *Start here.*
2. **Empty-state image swap** — code only, uses existing photos, ~half a day for all three.
3. **Section eyebrow glyphs on /guide** — test with emoji or a Lucide set first; commission custom only if the idea earns its keep.
4. **Bottom-nav icons** — commission only if the illustrator is trusted. Default Lucide is the safe floor.
5. **Producer page** — engineering + content. Hold until interviews exist.

---

## Anti-pattern flags

- **Don't decorate the cart.** Buyers there are in a "did I forget something?" state. Speed > warmth.
- **Don't add an icon to every nav element.** Desktop top nav is fine text-only; mobile bottom is where icons earn their keep.
- **Don't brand the qty stepper.** The + button doesn't need a leaf inside it.
- **Don't ship a teaching banner ("Tap a number to change it").** Dismissable banners get auto-dismissed without being read. PR #140's qty-pill border is the cheap fix already shipped.
