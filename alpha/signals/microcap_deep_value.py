"""Microcap deep-value detector (negative EV + quality gate).

Signal rationale:
    Microcap stocks (<$300M market cap) trading below net cash are some
    of the most asymmetric long opportunities available. Acquirer's
    Multiple research (Carlisle 2014) shows the negative-EV decile
    historically returned ~25% annualized.

    The catch: many negative-EV names are dying businesses burning cash.
    A quality gate (positive trailing 3-year FCF, no going-concern
    warning) eliminates most of these.

Best-case profile:
    - Market cap $20M - $300M
    - Cash > Market cap + Total debt (negative EV)
    - 3-year cumulative FCF > 0
    - Insider ownership > 15%
    - No Chinese VIE structure
    - No going-concern audit qualification
    - Trading on a real exchange (NYSE, NASDAQ, NYSEAMERICAN — not pink sheets)

Implementation notes:
    For now this signal consumes a candidate CSV that you populate
    quarterly from a fundamentals provider (Sharadar, SimFin, or yfinance
    `info` for a small universe). The CSV columns are:
        ticker, cik, market_cap_usd, cash_usd, total_debt_usd,
        fcf_3y_sum_usd, insider_ownership_pct, country, exchange,
        going_concern, vie_structure
    A live SEC XBRL Company Facts integration is the better long-term
    answer; for first-cut testing the CSV is fine.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from alpha.config import DATA_DIR
from alpha.signals.base import Signal, SignalHit


class MicrocapDeepValueSignal(Signal):
    name = "microcap_deep_value"

    def detect(self) -> Iterable[SignalHit]:
        candidates_csv = Path(self.cfg.get(
            "candidates_csv", DATA_DIR / "microcap_candidates.csv",
        ))
        if not candidates_csv.exists():
            return

        with candidates_csv.open() as f:
            for row in csv.DictReader(f):
                try:
                    mc   = float(row.get("market_cap_usd", 0))
                    cash = float(row.get("cash_usd", 0))
                    debt = float(row.get("total_debt_usd", 0))
                    fcf3 = float(row.get("fcf_3y_sum_usd", 0))
                    insider = float(row.get("insider_ownership_pct", 0))
                except (ValueError, TypeError):
                    continue

                if mc <= 0 or mc > 300_000_000:
                    continue
                # Negative EV check (market cap < net cash)
                net_cash = cash - debt
                ev = mc - net_cash
                if ev >= 0:
                    continue
                # Quality gate
                if fcf3 <= 0:
                    continue
                if (row.get("going_concern", "").lower() in ("yes", "true", "1")):
                    continue
                if (row.get("vie_structure", "").lower() in ("yes", "true", "1")):
                    continue
                if (row.get("country", "").upper() in ("CN", "CHINA")):
                    continue
                exchange = (row.get("exchange", "") or "").upper()
                if exchange in ("PINK", "OTC", "PK"):
                    continue
                if insider < 10:
                    # Soft preference; still flag at lower confidence
                    insider_bonus = 0.0
                else:
                    insider_bonus = 0.10

                # Compute "discount to net cash" as the magnitude of
                # negative EV relative to market cap
                discount = -ev / mc

                # Confidence scales with discount and FCF strength
                base_conf = 0.55 + min(0.20, discount * 0.5) + insider_bonus
                if fcf3 / mc > 0.20:
                    base_conf = min(0.90, base_conf + 0.05)

                # Asymmetry: net cash is your floor; upside is recovery to
                # book or higher. 3-5x asymmetry is typical for clean ones.
                asymmetry = 3.5 + min(1.5, discount * 2)

                headline = (
                    f"Microcap deep-value: {row.get('ticker')} "
                    f"(EV=${ev/1e6:.0f}M, mcap=${mc/1e6:.0f}M, "
                    f"net cash=${net_cash/1e6:.0f}M)"
                )
                rationale = (
                    f"Trading at ${mc/1e6:.0f}M with ${net_cash/1e6:.0f}M net cash "
                    f"(EV/mcap = {ev/mc:.0%}). "
                    f"3y cumulative FCF=${fcf3/1e6:.0f}M, insider ownership "
                    f"{insider:.0f}%. Diligence: pull 10-K for cash burn rate, "
                    "off-balance-sheet liabilities, and stock-based comp."
                )
                yield SignalHit(
                    signal_type=self.name,
                    ticker=row.get("ticker"),
                    cik=row.get("cik"),
                    headline=headline,
                    rationale=rationale,
                    confidence=min(0.95, base_conf),
                    asymmetry=asymmetry,
                    metadata=dict(row),
                )
