---
name: fingerlakes-farms-design
description: Use this skill to generate well-branded interfaces and assets for Fingerlakes Farms (FLF), a B2B local-food distributor in Upstate NY. Contains essential design guidelines, color tokens, type system, fonts, brand assets, and a portal UI kit for prototyping order-guide / cart / messaging flows.
user-invocable: true
---

Read the `README.md` file within this skill first — it covers the brand
voice, visual foundations, iconography, and the index of available files.
Then explore:

- `colors_and_type.css` — drop-in CSS variables for color, type, radius,
  shadow, motion. Link this in any mock.
- `assets/flf-logo.png` — the circular thumbs-up mark. SVG is on the
  backlog; use the PNG.
- `assets/photos/` — real ilovenyfarms.com photography for hero, cards,
  and editorial moments.
- `preview/` — small reference cards (colors, type, components) showing
  each token in use.
- `ui_kits/portal/` — interactive recreation of the FLF buyer portal
  (login, order guide, cart, confirmation, messages). Use these
  components as a starting point for any new B2B screen.

**Core rules that always apply:**

- Two brand colors: `--brand-blue` (#1763B5) for primary action and
  links; `--brand-green` (#2A9B46) **only** for the commit step (place
  order, confirm standing order) and success states.
- Voice is editorial, first-person plural, terse in transactional UI.
  No emoji in cart/checkout. No "please" in errors. No "successfully".
- Surfaces stay white. Cards use hairline borders, not background tints.
  Shadow is reserved for floating things (sticky cart bar, modal).
- `.tabular` on every price, qty, SKU, and date — column alignment
  matters in B2B ordering UIs.
- Bricolage Grotesque for display + headings (h1–h4), Inter for body.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy
assets out of this skill folder and link `colors_and_type.css` directly.
If working on production code in the portal repo, use the tokens in
`tailwind.config.ts` and the live `/style` page as the source of truth —
this skill is a mirror.

If the user invokes this skill without context, ask what they want to
build, ask a few framing questions (B2B vs DTC surface? marketing vs
transactional?), then act as an expert FLF brand designer and output
HTML artifacts or production code accordingly.
