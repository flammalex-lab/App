"""Spin-off detector.

Signal rationale:
    Small, "ugly" spin-offs from large parents are the single most-documented
    anomaly in event-driven equities. Index constraints + behavioural selling
    by parent holders drive prices below intrinsic for 6-18 months.

Best-case indicators (from Greenblatt + subsequent academic work):
    - Parent market cap >> spin market cap (size ratio < 15%).
    - Spin is in a different sector from parent.
    - Management migrating TO the spin.
    - Insider compensation tied to newco equity.
    - Spin is "too small to matter" to parent holders who rotate them out.

Filing types that surface this:
    - Form 10-12B / 10-12B/A: registration for spin-offs.
    - S-1 for parent IPO-style carve-outs.
    - 8-K Item 2.01 completion announcements.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class SpinoffSignal(Signal):
    name = "spinoff"

    def detect(self) -> Iterable[SignalHit]:
        lookback = int(self.cfg.get("lookback_days", 120))
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
            is_forced_seller_situation = md.get("forced_selling_likely", True)

            # Default conservative confidence if LLM has not yet run.
            if size_ratio is None:
                confidence = 0.5
                asymmetry = 2.5
                headline = f"Form 10 filed: {filing.company} (pending analysis)"
            else:
                # Greenblatt's sweet spot: 2-15% size ratio.
                if 2 <= size_ratio <= 15:
                    confidence = 0.75
                    asymmetry = 3.5
                elif 15 < size_ratio <= 30:
                    confidence = 0.55
                    asymmetry = 2.2
                else:
                    confidence = 0.35
                    asymmetry = 1.5
                if md.get("management_moves_to_newco"):
                    confidence = min(0.9, confidence + 0.1)
                    asymmetry += 0.5
                if is_forced_seller_situation:
                    confidence = min(0.95, confidence + 0.05)
                headline = (
                    f"Spin-off: {md.get('newco_name', filing.company)} "
                    f"from {md.get('parent_name', '?')} "
                    f"(size ratio {size_ratio}%)"
                )

            yield SignalHit(
                signal_type=self.name,
                ticker=md.get("newco_ticker"),
                cik=filing.cik,
                headline=headline,
                rationale=md.get("rationale",
                                  "Form 10 filed — typical spin-off setup. Read the "
                                  "Information Statement; look for size ratio, "
                                  "management migration, and comp alignment."),
                confidence=confidence,
                asymmetry=asymmetry,
                catalyst_date=md.get("distribution_date"),
                accession=filing.accession,
                metadata=md,
            )
