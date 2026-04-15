"""Activist 13D tracker.

Signal rationale:
    A 13D (as opposed to 13G) is an *active* filing — the filer intends to
    influence management. When a proven small-cap activist files 13D, the
    target historically generates 8-15% excess returns over 12-18 months
    (Brav, Jiang, Partnoy, Thomas 2008 and follow-ups).

Edges over the market:
    - Our whitelist focuses on activists with proven *small-cap* track
      records, where the inefficiency is largest and institutional coattail
      capital is smallest.
    - We monitor 13D/A amendments with Item 4 changes (escalation).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from alpha.config import activists
from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class ActivistSignal(Signal):
    name = "activist_13d"

    def detect(self) -> Iterable[SignalHit]:
        lookback = int(self.cfg.get("lookback_days", 7))
        start = date.today() - timedelta(days=lookback)
        whitelist = {a["cik"].lstrip("0"): a for a in activists()}
        whitelist_only = bool(self.cfg.get("whitelist_only", False))

        for filing in self.edgar.filings_for(
            [FormType.SC_13D, FormType.SC_13D_A], start=start
        ):
            # EDGAR's EFTS gives us the *subject* company. The filer (activist)
            # CIK lives inside the filing text; we defer to LLM extraction.
            cached = self.store.get_extraction(filing.accession, "activist_v1")
            if cached is None and self.llm is not None:
                doc = self.edgar.download_primary_document(filing)
                cached = self.llm.analyze_activist_13d(filing, doc)
            md = cached or {}

            filer_cik = (md.get("filer_cik") or "").lstrip("0")
            filer_name = md.get("filer_name", "Unknown filer")
            whitelisted = filer_cik in whitelist

            if whitelist_only and not whitelisted:
                continue

            # Confidence tiers
            if whitelisted:
                profile = whitelist[filer_cik]
                base_confidence = 0.8
                asymmetry = 3.0
                if profile.get("style") == "strategic-alternatives":
                    asymmetry = 3.5
            else:
                base_confidence = 0.45
                asymmetry = 1.8

            # Escalation (13D/A with board-seat or strategic-review language)
            escalation_terms = md.get("escalation_terms", [])
            if escalation_terms:
                base_confidence = min(0.95, base_confidence + 0.1)
                asymmetry += 0.7

            pct_owned = md.get("percent_owned")
            headline_stake = f"{pct_owned}% stake" if pct_owned else "stake"
            headline = f"{filer_name} filed {filing.form} on {filing.company} ({headline_stake})"

            rationale_bits = [
                f"Filer: {filer_name}" + (" [WHITELIST]" if whitelisted else ""),
                f"Target: {filing.company}",
            ]
            if md.get("purpose"):
                rationale_bits.append(f"Stated purpose: {md['purpose'][:200]}")
            if escalation_terms:
                rationale_bits.append("Escalation language: " + ", ".join(escalation_terms))

            yield SignalHit(
                signal_type=self.name,
                ticker=md.get("target_ticker"),
                cik=filing.cik,
                headline=headline,
                rationale=" | ".join(rationale_bits),
                confidence=base_confidence,
                asymmetry=asymmetry,
                accession=filing.accession,
                metadata={**md, "whitelisted": whitelisted},
            )
