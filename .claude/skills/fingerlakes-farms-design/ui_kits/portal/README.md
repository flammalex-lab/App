# Fingerlakes Farms Portal — UI kit

Interactive recreation of the B2B order portal at `flammalex-lab/App`.
This is a **hi-fi mock**, not production code — components are simplified
to React-with-Babel scripts so the index.html boots from any static host.

## Screens

The interactive demo (`index.html`) walks through:

1. **Phone login (OTP)** — buyer enters their number, gets a code.
2. **Order Guide** — saved list, par levels, one-tap reorder, cutoff clock.
3. **Cart** — review, sticky cart bar, place order on green.
4. **Order confirmed** — terse confirmation screen.
5. **Messages** — SMS-bridged thread with the rep.

## Components

- `BrandLogo.jsx` — circular mark from `/assets/flf-logo.png`.
- `CutoffClock.jsx` — top strip with "Tue 2pm cutoff · Zone 3".
- `StoreNav.jsx` — top nav with mark, links, cart count.
- `BottomTabs.jsx` — mobile bottom tab nav (Guide, Catalog, Cart, Messages, Account).
- `QtyInput.jsx` — typeable qty stepper.
- `GuideItem.jsx` — line in the order guide.
- `StickyCartBar.jsx` — bottom-floating cart bar with shadow-sticky.
- `Button.jsx`, `Badge.jsx`, `Field.jsx` — primitives.

All components share scope via `window.*` assignments at the bottom of
each file (Babel-in-browser quirk — see CLAUDE.md style note).
