"""SPAC warrant detection (post-de-SPAC orphans).

Signal rationale:
    When a SPAC completes its merger ("de-SPAC"), the warrants attached
    to the trust units (typically $11.50 strike, 5-year expiry from the
    merger close, often with cashless exercise on Reg A redemption)
    frequently trade at deep discounts to fair value. Reasons:
      - Original PIPE investors and SPAC sponsors get unrestricted
        common shares and dump warrants
      - Many brokerages don't display warrants prominently; retail
        ignores them
      - Warrants are not in any major index
      - Warrant price < $1 puts them below most institutional
        thresholds

    Asymmetric upside: a $0.50 warrant struck at $11.50 with 4 years
    to expiry on an underlying trading at $9 is a roughly 5-10x payoff
    if the underlying recovers to $20+ in that window.

Detection (heuristic without LLM):
    - Companies with a 'WS' or 'W' suffix on a recently-de-SPAC'd
      common ticker
    - Filed an 8-K with "business combination" language in the last
      24 months
    - Common stock currently trading below $11.50 (otherwise the
      warrant is already meaningful intrinsic and no longer cheap)
    - Common stock has positive trailing 12-month revenue (filter out
      shell companies)

This module consumes a candidates CSV (similar to microcap signal) for
the first cut; production version would scrape EDGAR for de-SPAC 8-Ks.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from alpha.config import DATA_DIR
from alpha.signals.base import Signal, SignalHit


class SpacWarrantSignal(Signal):
    name = "spac_warrant"

    def detect(self) -> Iterable[SignalHit]:
        candidates_csv = Path(self.cfg.get(
            "candidates_csv", DATA_DIR / "spac_warrant_candidates.csv",
        ))
        if not candidates_csv.exists():
            return

        with candidates_csv.open() as f:
            for row in csv.DictReader(f):
                try:
                    warrant_price = float(row.get("warrant_price", 0))
                    common_price  = float(row.get("common_price", 0))
                    strike        = float(row.get("strike", 11.5))
                    years_to_exp  = float(row.get("years_to_expiry", 0))
                    ttm_revenue   = float(row.get("ttm_revenue_usd", 0))
                except (ValueError, TypeError):
                    continue

                if warrant_price <= 0 or common_price <= 0:
                    continue
                # Skip if warrant is already deep ITM intrinsic — not cheap
                intrinsic = max(0, common_price - strike)
                if warrant_price > intrinsic + 1.5:
                    # too much time value premium baked in
                    pass
                # Skip if common is already above strike (warrant is no longer cheap)
                if common_price >= strike:
                    continue
                # Need enough time value
                if years_to_exp < 1:
                    continue
                # Filter out shell companies
                if ttm_revenue < 10_000_000:
                    continue

                # Compute breakeven — common needs to rise to strike + warrant_price
                breakeven = strike + warrant_price
                breakeven_pct = (breakeven / common_price - 1)

                # Estimate payoff at common = 1.5x current
                payoff_target = common_price * 1.5
                if payoff_target > strike:
                    payoff_per_warrant = payoff_target - strike
                    upside_x = payoff_per_warrant / warrant_price
                else:
                    upside_x = 0

                # Confidence is modest — these are binary
                confidence = 0.50
                if upside_x > 5:
                    confidence = 0.60
                if years_to_exp > 3:
                    confidence += 0.05
                # Asymmetry is huge if the bet works
                asymmetry = max(2.0, min(8.0, upside_x))

                headline = (
                    f"SPAC warrant: {row.get('warrant_ticker')} @ "
                    f"${warrant_price:.2f} (common ${common_price:.2f}, "
                    f"strike ${strike:.2f}, {years_to_exp:.1f}y to expiry, "
                    f"~{upside_x:.1f}x at common+50%)"
                )
                rationale = (
                    f"Warrant trading at ${warrant_price:.2f}. Common needs to "
                    f"reach ${breakeven:.2f} (+{breakeven_pct:.0%}) by expiry "
                    f"to break even. Underlying business has ${ttm_revenue/1e6:.0f}M "
                    "TTM revenue. Size small (1-2% per name); diversify across "
                    "10-15 warrants for the strategy to work."
                )
                yield SignalHit(
                    signal_type=self.name,
                    ticker=row.get("warrant_ticker"),
                    cik=row.get("cik"),
                    headline=headline,
                    rationale=rationale,
                    confidence=min(0.75, confidence),
                    asymmetry=asymmetry,
                    metadata=dict(row),
                )
