"""S&P / Russell index migration frontrunner (original).

Signal rationale:
    Index inclusion forces passive buying at the effective date. Academic
    literature (Chen, Noronha, Singal 2004; Petajisto 2011) documents ~3-8%
    abnormal returns in the days before inclusion.

    S&P 500 inclusion criteria (publicly documented):
    - US domicile
    - Market cap >= $18B (2026 thresholds, updated annually)
    - Public float >= 50%
    - 4 quarters of positive GAAP earnings (sum positive, most recent positive)
    - Adequate liquidity
    - Listed on NYSE, NASDAQ, CBOE

    S&P 400 (mid-cap) and S&P 600 (small-cap) have similar structured rules
    at lower thresholds. Russell rebalance happens in June each year with
    preliminary lists published in May — very predictable.

Detection:
    Screen the universe monthly for companies newly meeting inclusion
    criteria. Rank by liquidity of candidacy and recency of criteria-met.

    This module is designed to consume a prices/fundamentals feed (Sharadar,
    Polygon, etc.); in the interim it operates on a configurable CSV.
"""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from typing import Iterable

from alpha.config import DATA_DIR
from alpha.signals.base import Signal, SignalHit


# Thresholds for 2026 — update from official S&P methodology PDFs yearly.
SP500_MIN_MCAP = 18_000_000_000
SP400_MIN_MCAP = 7_400_000_000
SP600_MIN_MCAP = 1_100_000_000


class IndexMigrationSignal(Signal):
    name = "index_migration"

    def detect(self) -> Iterable[SignalHit]:
        candidates_path = Path(self.cfg.get(
            "candidates_csv", DATA_DIR / "index_candidates.csv"
        ))
        if not candidates_path.exists():
            return

        with candidates_path.open() as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    mcap = float(row.get("market_cap_usd", 0))
                    ttm_eps_sum = float(row.get("ttm_eps_sum", 0))
                    q_eps_last = float(row.get("q_eps_last", 0))
                    current_index = row.get("current_index", "").strip().upper()
                    float_pct = float(row.get("public_float_pct", 0))
                    adv_usd = float(row.get("avg_daily_volume_usd", 0))
                    domicile_us = row.get("domicile", "").upper() == "US"
                except (ValueError, TypeError):
                    continue

                target, gap_pct = self._target_index(mcap, current_index)
                if not target:
                    continue

                criteria_met = [
                    (domicile_us, "US domicile"),
                    (ttm_eps_sum > 0, "positive TTM earnings sum"),
                    (q_eps_last > 0, "positive last quarter"),
                    (float_pct >= 50, "public float >=50%"),
                    (adv_usd >= 1_000_000, "liquidity"),
                ]
                met = sum(1 for ok, _ in criteria_met if ok)
                if met < 4:
                    continue

                confidence = 0.5 + 0.1 * met
                asymmetry = 1.8   # modest but high-probability

                headline = (
                    f"Index-migration candidate: {row.get('ticker')} "
                    f"(to {target}; mcap ${mcap/1e9:.1f}B, gap {gap_pct:+.1f}%)"
                )
                rationale = (
                    f"Currently {current_index or 'unclassified'}. "
                    f"Meets {met}/5 structured inclusion criteria for {target}. "
                    "Index-addition events produce documented front-running "
                    "alpha in the 2-4 weeks prior to effective date."
                )
                yield SignalHit(
                    signal_type=self.name,
                    ticker=row.get("ticker"),
                    cik=row.get("cik"),
                    headline=headline,
                    rationale=rationale,
                    confidence=min(0.9, confidence),
                    asymmetry=asymmetry,
                    metadata={"target_index": target, "gap_pct": gap_pct,
                              "criteria": {label: ok for ok, label in criteria_met}},
                )

    @staticmethod
    def _target_index(mcap: float, current: str) -> tuple[str | None, float]:
        """Return (target_index_if_promoting, gap_pct_above_threshold)."""
        if current == "SP400" and mcap >= SP500_MIN_MCAP:
            return "SP500", (mcap / SP500_MIN_MCAP - 1) * 100
        if current == "SP600" and mcap >= SP400_MIN_MCAP:
            return "SP400", (mcap / SP400_MIN_MCAP - 1) * 100
        if not current and mcap >= SP600_MIN_MCAP:
            return "SP600", (mcap / SP600_MIN_MCAP - 1) * 100
        return None, 0.0
