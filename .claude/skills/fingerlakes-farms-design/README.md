# Fingerlakes Farms — Design System

> **Promise:** Trust our process. Trust your food.
> **Tagline:** Distributing Natural. Local. Sustainable. Food.
> **Established:** 2007 · Finger Lakes region, New York State.

This is a design system distilled from the Fingerlakes Farms ordering portal
(`flammalex-lab/App`) and the marketing site at ilovenyfarms.com. It's a
**B2B-first** system — buyers are restaurant owners, retail buyers, and
chefs who scan for facts. Editorial warmth belongs on marketing surfaces
and inside the brand voice; the cart stays terse.

---

## About Fingerlakes Farms

Fingerlakes Farms is a local-food distributor in Upstate New York. They
connect restaurants, retail operations, small businesses, and farmers'
markets with meat, dairy, and produce from vetted regional farms.

Sub-brands inside the org:

- **Grasslands** — beef program
- **Meadow Creek** — eggs
- **Fingerlakes Farms** — produce, dairy, carrier / distribution services
- **Flamm to Table** — DTC beef channel (Stripe checkout)
- *Chicken program suspended (March 2026)*

Every product runs through their **ThumbsUp™ Process**: stringent vetting
for safety, environmental sustainability, fair farmer wages, animal welfare,
and low-fossil-fuel production. The thumbs-up motif is core brand IP — it
appears in the logo.

---

## Sources & references

| Source | Where | Status |
| --- | --- | --- |
| Portal codebase | GitHub `flammalex-lab/App` (Next.js 14 + Tailwind + Supabase) | imported the key UI primitives + tokens |
| Live design page | `src/app/style/page.tsx` in the portal | source of truth for "what exists" |
| Design system doc | `docs/design-system.md` in the portal | source of truth for "why and how" |
| Marketing site | www.ilovenyfarms.com | screenshots in `uploads/` |
| Logo | `public/images/flf-logo.png` (PNG only — no SVG vector yet) | copied to `assets/flf-logo.png` |
| Photography | farm photo gallery from ilovenyfarms.com | copied to `assets/photos/` |

**Known gaps (flagged in original spec):**

- No vector SVG of the FLF mark — only the PNG. Sourcing one is on the
  backlog. UI kits use the PNG.
- The "Our Animals" line-icons on ilovenyfarms.com aren't in the repo and
  their license is unclear. We're substituting **Lucide** (MIT) via CDN.
- Catalog product photography (cutout vs in-context) is a separate
  workstream — not specced here.

---

## Content fundamentals

The voice is **editorial, farm-forward, first-person plural** ("we vet",
"we deliver"). Confident and declarative. Never salesy, never apologetic.
Specific over generic.

### Tone by surface

| Surface | Tone |
| --- | --- |
| Marketing / about pages | Editorial, warm, longform |
| Catalog & product pages | Clear, factual, photography-led |
| Cart, checkout, orders | Terse, transactional, no exclamation |
| Errors | Plain, blame the system not the buyer |
| Confirmations | Short. State the fact. No celebration. |

### Microcopy rules

- **No emoji** in transactional UI. Marketing pages: only on explicit opt-in.
- **No exclamation points** outside marketing copy.
- **No "please"** in errors or empty states — it sounds servile.
- **Never "successfully"** — if it's done, just say what's done.
- **Never "loading…"** — spinner + operation label (`"Placing order…"`).
- Reference the work (ThumbsUp™ Process, vetted growers, decades of
  distribution) rather than adjectives.
- Use **first-person plural** for the brand: *"We vet every grower."*
- Use **second-person** for the buyer: *"Your guide for Tuesday delivery."*

### Voice patterns (lift the rhythm, not the words)

**Cutoffs & timing**
- ✅ "Tue 2pm cutoff · Zone 3."
- ❌ "Hurry — only 4 hours left to order!"

**Stockouts**
- ✅ "Out for the season. We'll text you when next year's crop ships."
- ❌ "Sorry, this item is currently unavailable. Please check back later."

**Confirmations**
- ✅ "Standing order placed. 12 cases, every Friday."
- ❌ "Success! 🎉 Your standing order has been created successfully."

**Errors**
- ✅ "We couldn't reach the server. Try again, or text Alex if it sticks."
- ❌ "Oh no! Something went wrong. Please try again."

**Empty states**
- ✅ `"No items match 'heirloom'."` + CTA "Browse your guide."
- ❌ "Sorry, no results found. Please refine your search."

### Marketing voice (longer-form)

Marketing copy is the one place where the editorial register stretches.
Longer paragraphs, sentence rhythm, declarative claims. Still no emoji,
still first-person plural. The "Trust our process. Trust your food." line
on the marketing site is the canonical example of the register.

---

## Visual foundations

### Color philosophy

Two brand colors, both pulled from the logo:

- **`brand-blue` (#1763B5)** — primary action. Links. The wordmark.
  This is the workhorse — every button that *isn't* a commit step is blue.
- **`brand-green` (#2A9B46)** — reserved for **the commit moment**.
  Place order. Confirm standing order. Success states. Don't use green
  for routine "Save" buttons — it dilutes the moment.

Plus tints (`*-tint`) for selected washes, dark variants (`*-dark`) for
hover, gold/rust accents for editorial use, and a tight neutral ramp.

See `colors_and_type.css` for the full token table.

### Type

Two families:

- **Bricolage Grotesque** (700 / 800) — display + headings.
  Letter-spacing `-0.015em` on h1–h4, `-0.025em` on hero display.
- **Inter** (400 / 500 / 600 / 700) — body, UI, forms.

The **`.tabular`** utility (flips `tnum` + `lnum`) is non-negotiable on
prices, quantities, SKUs, and dates — column alignment matters in a B2B
ordering UI.

### Surfaces, cards, borders

Surfaces stay **white**. Cards earn separation with **hairline borders**
(`rgba(0,0,0,0.08)`) and spacing — *not* background tints. This is the
Baldor / Choco / Pepper move. Shadow is reserved for floating things:
sticky cart bar, modal, dropdown.

- `radius-md` (8px) — inputs, buttons.
- `radius-xl` (12px) — cards.
- `radius-2xl` (16px) — sheets, modals.
- `radius-full` — badges, the brand mark.

### Shadows

Three named shadows, used sparingly:

- `shadow-card` — gentle lift; rarely used because cards prefer borders.
- `shadow-sticky` — upward shadow under sticky cart bar.
- `shadow-floating` — modals, dropdowns, popovers.

### Motion

- **Easing:** `cubic-bezier(.2,.8,.2,1)` exposed as `--ease-fluent`.
- **Hover / press:** 150ms ease-out. Anything longer feels sluggish.
- **State changes** (modal open, slide-up, scale-in): 200–280ms with
  `--ease-fluent`.
- Named keyframes available: `fade-in`, `slide-up`, `scale-in`,
  `slide-in-right`, `sheet-up`.
- Respect `prefers-reduced-motion`.

### Hover / press states

- **Buttons** — bg shifts to `*-dark` on hover; `active:scale-[0.98]`
  on press (subtle 2% shrink, not a bounce).
- **Cards** — border deepens from `rgba(0,0,0,0.08)` to `0.16`.
  No lift, no shadow on hover.
- **Links** — color shifts blue → blue-dark; underline appears.
- **Inputs** — border switches to brand-blue + 2px tinted ring on focus.

### Imagery direction

**Real, close, of-the-place.** The reference is the ilovenyfarms.com
"Our Animals" hero: a Jersey cow framed tight enough to count the
eyelashes, red barn soft in the background. Not stocky, not staged.

- ✅ Tight crops of animals, hands, produce, equipment.
- ✅ Natural light, mostly outdoors, mostly daytime.
- ✅ Action shots: harvesting, loading the truck, milking. People at work.
- ❌ Stock photos. Buyers can smell them.
- ❌ "Happy farmer family" group shots with gear lined up.
- ❌ Heavy filters, vignettes, moody color grading.
- ❌ Type over busy photo without a contrast scrim.

### Backgrounds & transparency

- Pages live on pure white. No textures, no patterns, no gradients on
  body backgrounds.
- One soft gradient is allowed: `.bg-gradient-radial-soft` — a barely
  perceptible radial wash from white to `#f4f4f1` behind product cutout
  images so they don't sit on stark white.
- When type goes over photography (hero), add a **scrim** — a vertical
  black-to-transparent overlay, ~40% at the top, to keep contrast.
- Avoid blur / glass effects. Not part of the visual language.

### Layout rules

- Standard page padding: `px-4 md:px-6 lg:px-8`.
- Sticky cart bar floats above content on mobile; `shadow-sticky` lifts it.
- Bottom tab nav (mobile) uses `pb-safe` so it respects iOS home indicator.
- Spacing scale: Tailwind default (4px base).

---

## Iconography

The portal uses **Lucide** (MIT licensed, tree-shakable) for all utility
icons — cart, chevron, search, filter, menu, plus, minus. Editorial line
weight matches the Bricolage vibe.

For mocks, load Lucide from the CDN:

```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="shopping-cart"></i>
<script>lucide.createIcons();</script>
```

**Don't:**

- Don't use emoji in transactional UI.
- Don't ship the ilovenyfarms.com "Our Animals" line icons (in the
  screenshots) — they're not in the repo and their license is unclear.
- Don't draw your own SVGs to fake icons that exist in Lucide.

**The brand mark itself** is the only mandatory custom illustration — a
circular blue+green badge with a thumbs-up. Use `assets/flf-logo.png`.
A vector SVG is on the backlog. Treat the mark as sacrosanct: never
recolor, never letterspace the wordmark, never set on a busy photo
without a scrim.

---

## Index

```
.
├── README.md                  ← this file
├── SKILL.md                   ← agent-skill manifest (downloadable)
├── colors_and_type.css        ← tokens (use these in mocks)
├── assets/
│   ├── flf-logo.png           ← circular mark (PNG; SVG TBD)
│   ├── farm-cow-hero.jpg      ← in-repo hero photo
│   └── photos/                ← ilovenyfarms.com gallery photos
├── preview/                   ← Design System tab cards
├── ui_kits/
│   └── portal/                ← FLF ordering portal recreation
│       ├── README.md
│       ├── index.html         ← interactive demo (Order Guide, Cart, etc.)
│       └── *.jsx              ← components
└── uploads/                   ← original source materials
```

---

## What this design system explicitly does NOT include

(Deferred per the portal's `CLAUDE.md`.)

- Promo / coupon code styling.
- "You might also like" / recommendation patterns.
- Status timelines / order tracking UI.
- "Pay Now" CTAs / payment-state buttons.
- DTC voice register. **B2B only for v1.**

If a project needs one of these, design from first principles using the
tokens here — but flag the addition so the spec can absorb it.
