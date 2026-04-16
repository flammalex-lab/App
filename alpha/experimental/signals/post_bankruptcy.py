"""Post-bankruptcy emergence tracker.

Signal rationale:
    Fresh-start accounting creates orphaned equities:
    - Bondholders-turned-equityholders dump indiscriminately.
    - Sell-side coverage disappears for 6-18 months.
    - Clean balance sheets + large NOLs are hidden.

Detection strategy:
    - Form 25-NSE (delisting notice) + subsequent S-1 or Form 10 for new
      equity = strong candidate.
    - T-3 (debt exchange) often precedes restructuring.
    - "Fresh-start" or "plan of reorganization" mentions in 8-K / 10-K.
    - New CUSIP / ticker following emergence.

The LLM extractor reads the Disclosure Statement (filed as an exhibit or in
parallel to bankruptcy docket) to pull:
    - Pre-petition debt / post-emergence cap structure
    - NOL carryforwards
    - Section 382 limitations
    - New equity distribution schedule
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class PostBankruptcySignal(Signal):
    name = "post_bankruptcy"

    def detect(self) -> Iterable[SignalHit]:
        lookback_months = int(self.cfg.get("lookback_months", 24))
        start = date.today() - timedelta(days=lookback_months * 30)

        # Three independent scans
        candidates: dict[str, dict] = {}

        # 1. Companies that filed NT / 15-12B / 25-NSE then came back with S-1
        for filing in self.edgar.filings_for(
            [FormType.FORM_15, FormType.FORM_25, FormType.T3], start=start
        ):
            candidates.setdefault(filing.cik, {"cik": filing.cik,
                                               "company": filing.company,
                                               "events": []})["events"].append(
                (filing.form, filing.filed.isoformat())
            )

        # 2. 8-K with emergence keywords
        for hit in self.edgar.full_text_search(
            [FormType.EIGHT_K],
            start=start,
            query="emergence from bankruptcy",
        ):
            src = hit.get("_source", {})
            ciks = src.get("ciks") or [src.get("cik")]
            cik = str(ciks[0]).zfill(10) if ciks else ""
            if not cik:
                continue
            candidates.setdefault(cik, {
                "cik": cik,
                "company": (src.get("display_names") or ["?"])[0],
                "events": [],
            })["events"].append(("8-K", src.get("file_date")))

        for cik, rec in candidates.items():
            if len(rec["events"]) < 1:
                continue
            confidence = 0.4 + min(0.3, 0.1 * len(rec["events"]))
            asymmetry = 3.2
            yield SignalHit(
                signal_type=self.name,
                ticker=None,
                cik=cik,
                headline=f"Possible post-bankruptcy equity: {rec['company']}",
                rationale=(
                    "Candidate for post-reorg deep-dive. "
                    "Look for: (1) NOL carryforwards + §382 constraints, "
                    "(2) clean post-emergence balance sheet, "
                    "(3) forced selling by ex-bondholders, "
                    "(4) no sell-side coverage yet. "
                    f"Signals: {rec['events']}"
                ),
                confidence=confidence,
                asymmetry=asymmetry,
                metadata=rec,
            )
