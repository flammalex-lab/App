"""Ghost-ship detector (original).

Signal rationale:
    "Ghost ships" are companies that have gone dark — filed Form 15-12B to
    deregister from the SEC — but continue to operate real businesses and
    (crucially) still publish financials to state corporate registries or
    on their own websites. They trade on the pink sheets with near-zero
    coverage. Classic Walker's Manual territory.

    Why they're mispriced:
    - Institutions cannot own them (no SEC reporting).
    - Brokers often flag them "caveat emptor."
    - Index funds are mandatory sellers on deregistration.
    - Retail investors can't find price history easily.

    What to look for:
    - Positive book value and positive FCF before going dark.
    - Insider ownership >50%.
    - Continues to file state-level reports (Delaware, Nevada franchise tax).
    - Publishes unaudited financials voluntarily.

Detection:
    - Scan Form 15-12B and 25-NSE filings for deregistering companies.
    - Pull their last 10-K; filter on quality metrics.
    - Output candidates for manual deep-dive.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class GhostShipSignal(Signal):
    name = "ghost_ship"

    def detect(self) -> Iterable[SignalHit]:
        lookback = int(self.cfg.get("lookback_days", 365))
        start = date.today() - timedelta(days=lookback)

        for filing in self.edgar.filings_for(
            [FormType.FORM_15, FormType.FORM_25], start=start
        ):
            # Find the last 10-K filed by this CIK before deregistration.
            try:
                subs = self.edgar.company_submissions(filing.cik)
            except Exception:  # noqa: BLE001
                continue
            recent = subs.get("filings", {}).get("recent", {})
            forms_list = recent.get("form", [])
            dates_list = recent.get("filingDate", [])
            last_10k_idx = next(
                (i for i, f in enumerate(forms_list) if f == "10-K"), None
            )
            if last_10k_idx is None:
                continue
            last_10k_date = dates_list[last_10k_idx]

            # Candidate. Score conservatively — real diligence is manual.
            yield SignalHit(
                signal_type=self.name,
                ticker=subs.get("tickers", [None])[0]
                    if subs.get("tickers") else None,
                cik=filing.cik,
                headline=(
                    f"Ghost-ship candidate: {filing.company} "
                    f"(deregistered {filing.filed}, last 10-K {last_10k_date})"
                ),
                rationale=(
                    "Company filed Form 15 / 25 to deregister. "
                    "If the underlying business is still operating and "
                    "profitable, forced-selling by institutions creates a "
                    "deep-value opportunity in the pink sheets. "
                    "Diligence steps: pull last 10-K for FCF / book value, "
                    "check Delaware franchise-tax filings for ongoing "
                    "operations, check for voluntary published financials."
                ),
                confidence=0.4,  # requires manual diligence
                asymmetry=4.0,   # very asymmetric when it works
                metadata={
                    "dereg_date": filing.filed.isoformat(),
                    "last_10k_date": last_10k_date,
                    "last_10k_accession": recent.get("accessionNumber",
                                                       [None])[last_10k_idx],
                },
            )
