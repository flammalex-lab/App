"""Conference-call hedging language scorer (original).

Signal rationale:
    Larcker & Zakolyukina (2012, JAR) showed that CEOs/CFOs of firms that
    later restate earnings use measurably more hedging language, more
    extreme positives, and fewer self-references on the preceding calls.
    These linguistic tells are robust in out-of-sample windows.

    We extend the idea: extreme *change* in hedging-language density between
    consecutive calls (especially if coincident with insider selling) is a
    short / avoid signal. Conversely, a CFO whose calls suddenly become
    *more concrete* and metrics-based after a period of vagueness often
    signals a positive inflection.

Note: we don't have direct conference-call transcript access from EDGAR;
this module consumes transcripts from a pluggable source (e.g., 10-Q MD&A
text, press releases, or an external transcript API). The scoring function
is the same either way.
"""
from __future__ import annotations

import math
import re
from typing import Iterable

from alpha.signals.base import Signal, SignalHit


HEDGING_TERMS = {
    "approximately", "around", "roughly", "somewhat", "may", "might",
    "perhaps", "possibly", "could potentially", "we believe", "we think",
    "to be honest", "frankly", "I would say", "in some sense",
    "certain", "various", "meaningful", "reasonable",
}

CONCRETE_TERMS = {
    "quarter-over-quarter", "basis points", "units shipped", "gross margin",
    "operating margin", "free cash flow", "return on invested capital",
}


def density(text: str, terms: set[str]) -> float:
    words = re.findall(r"[A-Za-z']+", text.lower())
    if not words:
        return 0.0
    phrase_text = " " + " ".join(words) + " "
    hits = 0
    for t in terms:
        hits += phrase_text.count(f" {t} ")
    return hits / max(1, len(words))


class HedgingLanguageSignal(Signal):
    name = "hedging_language"

    def detect(self) -> Iterable[SignalHit]:
        """
        Expected to be fed via a transcript-ingestion pipeline that stores
        (ticker, call_date, text) tuples. Here we demonstrate the scoring
        logic on whatever transcripts exist in the extractions table.
        """
        with self.store.conn() as c:
            rows = list(c.execute(
                """
                SELECT e1.accession AS curr_acc,
                       e1.payload_json AS curr,
                       e2.payload_json AS prev,
                       f.ticker AS ticker,
                       f.cik AS cik,
                       f.company AS company
                FROM extractions e1
                JOIN extractions e2
                  ON e2.schema_name='transcript_v1'
                 AND e2.id < e1.id
                JOIN filings f ON f.accession = e1.accession
                WHERE e1.schema_name='transcript_v1'
                ORDER BY e1.extracted_at DESC
                LIMIT 200
                """
            ))

        import json
        for r in rows:
            try:
                curr = json.loads(r["curr"])
                prev = json.loads(r["prev"])
            except Exception:  # noqa: BLE001
                continue
            c_text = curr.get("transcript_text", "")
            p_text = prev.get("transcript_text", "")
            if not c_text or not p_text:
                continue
            c_hedge = density(c_text, HEDGING_TERMS)
            p_hedge = density(p_text, HEDGING_TERMS)
            c_conc = density(c_text, CONCRETE_TERMS)
            p_conc = density(p_text, CONCRETE_TERMS)

            delta_hedge = c_hedge - p_hedge
            delta_conc = c_conc - p_conc

            if delta_hedge > 0.004:
                asymmetry = -2.0  # short / avoid
                headline = f"Hedging language spike: {r['ticker'] or r['company']}"
                rationale = (
                    f"Hedging density increased from {p_hedge*1000:.2f}/kw to "
                    f"{c_hedge*1000:.2f}/kw between consecutive calls. "
                    "Larcker-Zakolyukina showed this precedes negative fundamental "
                    "surprises."
                )
                conf = 0.55
            elif delta_conc > 0.003 and delta_hedge < 0:
                asymmetry = 2.5
                headline = f"CFO language tightening: {r['ticker'] or r['company']}"
                rationale = (
                    "Call became measurably more metric-driven and less "
                    "hedged. Often precedes positive inflection."
                )
                conf = 0.6
            else:
                continue

            yield SignalHit(
                signal_type=self.name,
                ticker=r["ticker"],
                cik=r["cik"],
                headline=headline,
                rationale=rationale,
                confidence=conf,
                asymmetry=asymmetry,
                metadata={
                    "delta_hedge_per_kw": round(delta_hedge * 1000, 2),
                    "delta_concrete_per_kw": round(delta_conc * 1000, 2),
                },
            )
