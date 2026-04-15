"""Spin-off detector.

Signal rationale:
    Small, "ugly" spin-offs from large parents are the single most-documented
    anomaly in event-driven equities. Index constraints + behavioural selling
    by parent holders drive prices below intrinsic for 6-18 months.

Walk-forward calibration (n=197 Form 10s, 2015-2024 — see
data/backtest/SIZE_FILTER_FINDINGS.md):

    18-month mean returns (excess vs IWM):
      - nano  newco (<$500M):      +47.9%   (n=24, 67% hit rate)
      - small newco ($500M-$2B):   +39.9%   (n=37, 57% hit rate)
      - mid   newco ($2B-$10B):     +7.1%   (n=40, 55% hit rate)
      - large newco (>$10B):       +23.0%   (n=11, 82% hit rate)

    Implication: filtering to nano + small newcos doubles excess
    returns. Confidence/asymmetry weights below are calibrated to
    these numbers.

Filing types that surface this:
    - Form 10-12B / 10-12B/A: registration for spin-offs.
    - S-1 for parent IPO-style carve-outs.
    - 8-K Item 2.01 completion announcements.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Optional

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


def _add_trading_days(d: date, n: int) -> date:
    """Approximate — weekends only, no holidays. Good enough for a 'ready date'."""
    cur = d
    added = 0
    while added < n:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


def size_bucket_weights(newco_mcap: Optional[float]) -> tuple[float, float, str]:
    """Return (confidence_multiplier, asymmetry, label) per backtest."""
    if newco_mcap is None:
        return (1.0, 2.5, "size-pending")
    if newco_mcap < 500_000_000:
        return (1.15, 4.5, "nano")          # highest mean+excess
    if newco_mcap < 2_000_000_000:
        return (1.10, 4.0, "small")          # sweet spot (high mean + best hit rate)
    if newco_mcap < 10_000_000_000:
        return (0.75, 1.7, "mid")            # underperforms
    return (0.95, 2.5, "large")              # surprisingly good at 18m+


class SpinoffSignal(Signal):
    name = "spinoff"

    def detect(self) -> Iterable[SignalHit]:
        lookback = int(self.cfg.get("lookback_days", 120))
        entry_delay = int(self.cfg.get("entry_delay_trading_days", 21))
        start = date.today() - timedelta(days=lookback)

        for filing in self.edgar.filings_for(
            [FormType.FORM_10, FormType.FORM_10_A], start=start
        ):
            self.store.upsert_filing({
                "accession": filing.accession,
                "cik": filing.cik,
                "company": filing.company,
                "ticker": None,
                "form": filing.form,
                "filed_date": filing.filed.isoformat(),
                "primary_doc": filing.primary_doc,
                "url": filing.url,
            })

            # Initial triage: every Form 10 is a candidate.
            # LLM layer later extracts size ratio, sector, management moves.
            cached = self.store.get_extraction(filing.accession, "spinoff_v1")
            if cached is None and self.llm is not None:
                doc = self.edgar.download_primary_document(filing)
                cached = self.llm.analyze_spinoff(filing, doc)

            md = cached or {}
            size_ratio = md.get("size_ratio_pct")
            newco_mcap = md.get("newco_est_market_cap_usd")
            is_forced_seller_situation = md.get("forced_selling_likely", True)

            # Step 1: Apply backtested size bucket weights (most predictive)
            size_mult, base_asymmetry, size_label = size_bucket_weights(newco_mcap)

            # Step 2: Layer on size_ratio info from LLM if available
            if size_ratio is None and newco_mcap is None:
                confidence = 0.5
                asymmetry = base_asymmetry
                headline = f"Form 10 filed: {filing.company} (pending analysis)"
            elif size_ratio is None:
                # Have newco mcap but no parent ratio yet
                confidence = 0.55 * size_mult
                asymmetry = base_asymmetry
                headline = (
                    f"Form 10 filed: {filing.company} "
                    f"(newco_mcap=${newco_mcap/1e9:.2f}B, {size_label})"
                )
            else:
                # Both newco mcap and size ratio available
                if 2 <= size_ratio <= 15:
                    base_conf = 0.75
                    asymmetry = base_asymmetry + 0.5   # extra credit for ratio confirm
                elif 15 < size_ratio <= 30:
                    base_conf = 0.55
                    asymmetry = base_asymmetry
                else:
                    base_conf = 0.35
                    asymmetry = max(1.5, base_asymmetry - 1.0)
                confidence = min(0.95, base_conf * size_mult)
                if md.get("management_moves_to_newco"):
                    confidence = min(0.95, confidence + 0.10)
                    asymmetry += 0.5
                if is_forced_seller_situation:
                    confidence = min(0.95, confidence + 0.05)
                headline = (
                    f"Spin-off: {md.get('newco_name', filing.company)} "
                    f"from {md.get('parent_name', '?')} "
                    f"(ratio {size_ratio}%, {size_label})"
                )

            # Enforce backtested "wait out forced selling" rule: the signal's
            # actionable entry date is filed + 21 trading days.
            ready_date = _add_trading_days(filing.filed, entry_delay)

            yield SignalHit(
                signal_type=self.name,
                ticker=md.get("newco_ticker"),
                cik=filing.cik,
                headline=headline,
                rationale=md.get("rationale",
                                  "Form 10 filed — typical spin-off setup. Read the "
                                  "Information Statement; look for size ratio, "
                                  "management migration, and comp alignment. "
                                  f"Entry ready date: {ready_date} "
                                  f"(filing + {entry_delay} trading days, per backtest)."),
                confidence=confidence,
                asymmetry=asymmetry,
                catalyst_date=md.get("distribution_date") or ready_date,
                accession=filing.accession,
                metadata={**md, "entry_ready_date": ready_date.isoformat(),
                          "entry_delay_trading_days": entry_delay,
                          "size_label": size_label,
                          "size_multiplier": size_mult},
            )
