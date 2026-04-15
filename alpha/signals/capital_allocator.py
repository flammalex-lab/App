"""Capital allocator regime change (original).

Signal rationale:
    Most business quality is *path-dependent on capital allocation*. A
    sudden, multi-signal regime change — new CFO + first-ever buyback +
    C-suite open-market purchases — is historically a reliable re-rating
    catalyst. The market slow-plays regime changes because of status-quo
    bias and because sell-side waits for "proof" (2-3 quarters).

Regime-change composite (need >= 2 of the following within 120 days):
    1. New CFO announced (8-K Item 5.02).
    2. New buyback authorization (8-K Item 8.01 or press release).
    3. Dividend initiation or unusual increase.
    4. Material insider open-market buys (Form 4 Code P).
    5. Debt paydown or refinancing at significantly lower rate.
    6. Divestiture of non-core segment (8-K Item 2.01).

This signal consumes the signals emitted by InsiderClusterSignal plus EDGAR
8-K items.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


CEO_CFO_CHANGE_KEYWORDS = [
    "appointment of chief financial officer",
    "new chief financial officer",
    "appointment of chief executive officer",
    "departure of chief financial officer",
]
BUYBACK_KEYWORDS = [
    "share repurchase program",
    "authorization to repurchase",
    "accelerated share repurchase",
]
DIVIDEND_KEYWORDS = [
    "initiate a quarterly cash dividend",
    "declared its first",
]
DIVESTITURE_KEYWORDS = [
    "divestiture",
    "sale of non-core",
]


class CapitalAllocatorRegimeSignal(Signal):
    name = "capital_allocator_regime"

    def detect(self) -> Iterable[SignalHit]:
        window_days = int(self.cfg.get("window_days", 120))
        required = int(self.cfg.get("signals_required", 2))
        start = date.today() - timedelta(days=window_days)

        # Per-CIK set of regime-change events observed in the window.
        events: dict[str, set[str]] = defaultdict(set)
        meta: dict[str, dict] = defaultdict(lambda: {"company": "", "cik": ""})

        keyword_to_event = [
            (CEO_CFO_CHANGE_KEYWORDS, "exec_change"),
            (BUYBACK_KEYWORDS, "buyback"),
            (DIVIDEND_KEYWORDS, "dividend"),
            (DIVESTITURE_KEYWORDS, "divestiture"),
        ]
        for kws, label in keyword_to_event:
            for kw in kws:
                for hit in self.edgar.full_text_search(
                    [FormType.EIGHT_K], start=start, query=kw, max_pages=3,
                ):
                    src = hit.get("_source", {})
                    ciks = src.get("ciks") or [src.get("cik")]
                    cik = str(ciks[0]).zfill(10) if ciks else ""
                    if not cik:
                        continue
                    events[cik].add(label)
                    meta[cik]["company"] = (src.get("display_names") or ["?"])[0]
                    meta[cik]["cik"] = cik

        # Merge with insider-cluster signals already recorded in DB.
        for row in self.store.insider_clusters(
            days=window_days, min_buyers=2, min_total_usd=100_000
        ):
            cik = row["cik"]
            if cik:
                events[cik].add("insider_cluster")
                meta[cik]["company"] = row["issuer_ticker"] or meta[cik].get("company", "")
                meta[cik]["cik"] = cik

        for cik, evset in events.items():
            if len(evset) < required:
                continue
            confidence = min(0.9, 0.55 + 0.1 * len(evset))
            # More signals = larger expected re-rating (2x+ has been typical).
            asymmetry = 2.0 + 0.5 * len(evset)

            headline = (
                f"Capital-allocator regime shift: {meta[cik]['company']} "
                f"({', '.join(sorted(evset))})"
            )
            rationale = (
                "Multi-signal regime change detected. Historical pattern: "
                "markets slow-play regime shifts because sell-side waits 2-3 "
                "quarters for 'proof.' Expected re-rating window 6-18 months."
            )
            yield SignalHit(
                signal_type=self.name,
                ticker=None,
                cik=cik,
                headline=headline,
                rationale=rationale,
                confidence=confidence,
                asymmetry=asymmetry,
                metadata={"events": sorted(evset), **meta[cik]},
            )
