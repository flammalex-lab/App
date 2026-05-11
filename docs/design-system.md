# Fingerlakes Farms — Design system

This is the spec. The live render is at [`/style`](../src/app/style/page.tsx)
— if a token, component, or example here disagrees with that page, the page
wins. Tokens are defined once in `tailwind.config.ts` and `src/app/globals.css`.

This system is **B2B-first**. Buyers are restaurant owners, retail buyers,
and chefs. They scan for facts; they don't have time for marketing fluff in
transactional UI. Editorial warmth belongs on marketing surfaces and inside
the brand voice, not in the cart.

---

## 1. Brand foundations

### Promise
> Trust our process. Trust your food.

### Voice
- Editorial, farm-forward, first-person plural ("we vet", "we deliver").
- Confident and declarative. Never salesy, never apologetic.
- Specific over generic: *"Zone 3 · Tue 2pm cutoff"* beats *"Order soon!"*.
- Reference the work (the ThumbsUp™ Process, vetted growers, decades of
  distribution) rather than adjectives.

### Tone by surface

| Surface                  | Tone                                     |
| ------------------------ | ---------------------------------------- |
| Marketing / about pages  | Editorial, warm, longform                |
| Catalog & product pages  | Clear, factual, photography-led          |
| Cart, checkout, orders   | Terse, transactional, no exclamation     |
| Errors                   | Plain, blame the system not the buyer    |
| Confirmations            | Short. State the fact. No celebration.   |

### Logo
- Primary mark: circular FLF logo (`/public/images/flf-logo.png`). Vector
  SVG is **missing** — sourcing one is on the backlog.
- Wordmark: "Fingerlakes Farms" in Bricolage Grotesque, tracking -0.025em,
  brand-blue.
- Pair mark + wordmark on desktop. Mark alone is enough on mobile.
- Never recolor, never letterspace the wordmark differently, never set on a
  busy photo without a contrast scrim.

---

## 2. Color

All swatches live on `/style`. Names match the Tailwind keys.

| Family   | Key                | Hex     | Role                              |
| -------- | ------------------ | ------- | --------------------------------- |
| Brand    | `brand-blue`       | #1763B5 | Primary action, links             |
|          | `brand-blue-dark`  | #0F4A8A | Hover / pressed                   |
|          | `brand-blue-tint`  | #E5EFF8 | Selected wash                     |
|          | `brand-green`      | #2A9B46 | Success, freshness, **place order** |
|          | `brand-green-dark` | #1F7A35 | Success hover                     |
|          | `brand-green-tint` | #E6F4EA | Success wash                      |
| Accent   | `accent-gold`      | #C49431 | Pending, warning                  |
|          | `accent-rust`      | #A0522D | Editorial accent only             |
| Ink      | `ink-primary`      | #161616 | Body, headings                    |
|          | `ink-secondary`    | #5E5E5E | Helper, supporting copy           |
|          | `ink-tertiary`     | #9A9A9A | Captions, placeholder, meta       |
| Surface  | `bg-primary`       | #FFFFFF | Page surface                      |
|          | `bg-secondary`     | #F4F4F1 | Hover, thumb placeholder          |
|          | `bg-tinted`        | #EAF1F6 | Highlight wash                    |
| Feedback | `feedback-success` | #2A9B46 | Confirmation states               |
|          | `feedback-warning` | #C49431 | Cutoff approaching                |
|          | `feedback-error`   | #C13A28 | Errors, cancellation              |

**Rules of thumb**
- Primary action is always brand-blue. The only place green shows up as a
  button is the *commit* step (Place order, Confirm standing order). Don't
  use green for routine "Save" buttons — it dilutes the moment.
- Surfaces stay white. Cards earn their separation with hairline borders
  and spacing — not background tints. Shadow is reserved for floating
  elements (sticky cart bar, modal, dropdown).
- Accent-rust is editorial-only. Don't put it on a button.

---

## 3. Typography

- **Display**: Bricolage Grotesque (700 / 800), loaded via `next/font`.
  Set on `h1–h4` automatically, plus the `.display` utility for hero copy.
  Letter-spacing: -0.015em on headings, -0.025em on hero display.
- **Sans**: Inter (400 / 500 / 600 / 700). Body copy, UI, forms.
- **Tabular**: `.tabular` utility flips `tnum` + `lnum`. **Always use on
  prices, quantities, SKUs, dates** — column alignment matters in B2B
  ordering UIs.

### Scale (the practical one, not every Tailwind step)

| Use                    | Class                        | Notes                       |
| ---------------------- | ---------------------------- | --------------------------- |
| Hero display           | `display text-5xl`           | Marketing pages only        |
| Page title             | `display text-3xl`           | One per page                |
| Section heading        | `h2` / `text-2xl`            | Bricolage 700               |
| Card title             | `display text-base`          | or `text-lg`                |
| Body                   | `text-base`                  | `leading-relaxed` for prose |
| Supporting             | `text-sm text-ink-secondary` | Helper copy, meta rows      |
| Caption / eyebrow      | `text-xs uppercase tracking-wide text-ink-tertiary` | Status, labels |
| Money / qty / SKU      | `tabular text-base`          | Always tabular              |

---

## 4. Spacing, radius, shadow

- Spacing scale: Tailwind default (4px base). Standard page padding is
  `px-4 md:px-6 lg:px-8`.
- Radius: `rounded-md` for inputs/buttons, `rounded-xl` for cards,
  `rounded-2xl` for sheets, `rounded-full` for badges and the brand mark.
- Shadows: `shadow-card` (default card lift, rarely used since cards
  border), `shadow-sticky` (upward shadow for the sticky cart bar),
  `shadow-floating` (modals, dropdowns, popovers).

---

## 5. Motion

- Easing: `cubic-bezier(.2,.8,.2,1)`, exposed as `ease-fluent`.
- Hover / press: 150ms ease-out. Anything longer feels sluggish.
- State changes (modal open, slide-up, scale-in): 200–280ms with
  `ease-fluent`.
- Named keyframes available: `animate-fade-in`, `animate-slide-up`,
  `animate-scale-in`, `animate-slide-in-right`, `animate-sheet-up`.
- Respect `prefers-reduced-motion`. (TODO: audit — many pages don't yet.)

---

## 6. Components

Live render: `/style` → Components section.

| Primitive       | Path                                        | Notes                                  |
| --------------- | ------------------------------------------- | -------------------------------------- |
| Button          | `src/components/ui/Button.tsx`              | `primary`, `secondary`, `ghost`, `danger`, sizes `sm`/`md`/`lg`, `loading` prop |
| Input / Field   | `src/components/ui/Input.tsx`               | `Field` wraps label + hint             |
| QtyInput        | `src/components/ui/QtyInput.tsx`            | Numeric on mobile, commit on blur/Enter |
| Badge / Chip    | `src/components/ui/Badge.tsx`               | `StatusBadge` is order-status aware    |
| EmptyState      | `src/components/ui/EmptyState.tsx`          | Standard empty/empty-search pattern    |
| BottomSheet     | `src/components/ui/BottomSheet.tsx`         | Mobile sheet, morphs to centered modal on md+ |
| Toast           | `src/components/ui/Toast.tsx`               | Provider-based, 3.2s auto-dismiss      |
| BrandLogo / Wordmark | `src/components/Brand.tsx`             | Use everywhere; don't inline the PNG   |

When adding a new primitive: add it to `/style` in the same PR.

---

## 7. Photography & imagery

### Direction
Real, close, of-the-place. The reference standard is the ilovenyfarms.com
"Our Animals" hero: a Jersey cow framed tight enough to count the eyelashes,
red barn soft in the background. Not stocky, not staged.

**Do**
- Tight crops of animals, hands, produce, equipment.
- Natural light, mostly outdoors, mostly daytime.
- Action shots: harvesting, loading the truck, milking. People at work.
- Close-ups of single ingredients on neutral surfaces for catalog.

**Don't**
- Stock photos. Buyers can smell them.
- Group "happy farmer family" shots with the gear lined up.
- Heavy filters, vignettes, or moody color grading.
- Overlaying type on a busy photo without a scrim.

### Sourcing (open)
- Right now we have one in-repo photo (`public/images/IMG_7794-scaled-3.jpg`).
- The ilovenyfarms.com images are likely usable (same owner) but need
  confirmation before we mirror them into the repo.
- Catalog product photography is its own workstream — separate spec needed
  for cutout vs in-context shots.

### Icons
- The line icons on ilovenyfarms.com ("Our Animals" bullets) are not in
  this repo and their license is unclear. Don't ship them yet.
- For utility icons (cart, chevron, search), use **Lucide** going forward.
  Editorial vibe, MIT licensed, tree-shakable. (Not yet installed.)

---

## 8. Voice patterns (B2B)

The point of these examples is the *register*, not the literal copy. Lift
the rhythm, not the words.

### Cutoffs & timing
- **Yes**: "Tue 2pm cutoff · Zone 3."
- **No**: "Hurry — only 4 hours left to order!"

### Stockouts
- **Yes**: "Out for the season. We'll text you when next year's crop ships."
- **No**: "Sorry, this item is currently unavailable. Please check back later."

### Confirmations
- **Yes**: "Standing order placed. 12 cases, every Friday."
- **No**: "Success! 🎉 Your standing order has been created successfully."

### Errors
- **Yes**: "We couldn't reach the server. Try again, or text Alex if it sticks."
- **No**: "Oh no! Something went wrong. Please try again."

### Empty states
- **Yes**: "No items match 'heirloom'." + CTA "Browse your guide."
- **No**: "Sorry, no results found. Please refine your search."

### Microcopy don'ts
- No emoji in transactional UI. Marketing pages: only on explicit opt-in.
- No exclamation points outside of marketing copy.
- Avoid "please" in error/empty states — it sounds servile and adds noise.
- Don't say "successfully" — if it's done, just say what's done.
- Don't say "loading…" — show a spinner with the operation
  (`loadingLabel="Placing order…"`).

---

## 9. What this design system explicitly does NOT include

(Deferred per CLAUDE.md.)

- Promo / coupon code styling.
- "You might also like" / recommendation patterns.
- Status timelines / order tracking UI.
- "Pay Now" CTAs / payment-state buttons.
- DTC voice register. **B2B only for v1.**

---

## 10. Maintenance

- Tokens live in `tailwind.config.ts` (colors, fonts, shadows, motion) and
  `src/app/globals.css` (component classes like `btn-primary`, `badge-*`).
- Add new primitives to `src/components/ui/` and surface them on `/style`
  in the same PR.
- Treat `/style` like a test: if it stops rendering correctly, something
  drifted.
- This doc updates when intent changes — not for every component tweak.
  The live page is the source of truth for *what* exists; this doc is the
  source of truth for *why* and *how to use it*.
