"""Insider cluster detector.

Signal rationale:
    Single insider purchases are noisy. *Clusters* (multiple insiders across
    different roles buying within a short window) are one of the most
    empirically robust predictors of forward returns — especially in
    small-caps (Lakonishok & Lee 2001; Cohen, Malloy & Pomorski 2012 showed
    that "opportunistic" insider buys yield ~7% annual alpha).

Quality weighting:
    - CEO + CFO + multiple directors in the same ~30-day window > token
      single-director buy.
    - Open-market purchases (Code P) > automatic grants / option exercises.
    - Dollar threshold filters out sub-$10K "nominal" compliance buys.

Data source:
    Form 4 XML is parsed on the fly; we rely on the LLM layer to normalize
    edge cases (multi-line transactions, derivative vs. non-derivative).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class InsiderClusterSignal(Signal):
    name = "insider_cluster"

    def detect(self) -> Iterable[SignalHit]:
        lookback = int(self.cfg.get("lookback_days", 30))
        start = date.today() - timedelta(days=lookback)

        # 1. Ingest recent Form 4s into the insider_trades table.
        for filing in self.edgar.filings_for([FormType.FORM_4], start=start):
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
            cached = self.store.get_extraction(filing.accession, "form4_v1")
            if cached is None and self.llm is not None:
                doc = self.edgar.download_primary_document(filing)
                parsed = self.llm.analyze_form4(filing, doc)
                for trade in parsed.get("trades", []):
                    trade.setdefault("accession", filing.accession)
                    trade.setdefault("cik", filing.cik)
                    self.store.insert_insider_trade(trade)

        # 2. Cluster query across the whole insider_trades table.
        min_buyers = int(self.cfg.get("min_buyers", 3))
        min_total = float(self.cfg.get("min_total_usd", 250_000))

        for row in self.store.insider_clusters(
            days=lookback, min_buyers=min_buyers, min_total_usd=min_total
        ):
            # Confidence scales with diversity of roles and $ size.
            role_diversity = (row["officer_buys"] > 0) + (row["director_buys"] > 0)
            role_bonus = 0.1 * role_diversity
            size_bonus = min(0.15, (row["total_usd"] / 2_000_000) * 0.15)
            confidence = min(0.95, 0.55 + role_bonus + size_bonus)
            asymmetry = 2.5 + (1.0 if row["officer_buys"] > 0 else 0)

            headline = (
                f"Insider cluster at {row['issuer_ticker'] or row['cik']}: "
                f"{row['buyers']} buyers, "
                f"${row['total_usd']:,.0f} in last {lookback}d"
            )
            rationale = (
                f"Open-market purchases by {row['buyers']} distinct insiders "
                f"(officers: {row['officer_buys']}, directors: {row['director_buys']}). "
                "Clusters with cross-role participation have historically "
                "predicted positive forward returns."
            )
            yield SignalHit(
                signal_type=self.name,
                ticker=row["issuer_ticker"],
                cik=row["cik"],
                headline=headline,
                rationale=rationale,
                confidence=confidence,
                asymmetry=asymmetry,
                metadata=dict(row),
            )
