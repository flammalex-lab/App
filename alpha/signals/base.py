"""Signal base class.

Each signal is a detector: given the EDGAR client + store + LLM, it returns
zero or more `SignalHit` objects. The scoring layer later combines hits by
ticker into a composite score.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable

from alpha.edgar import EdgarClient
from alpha.store import Store

log = logging.getLogger("alpha.signals")


@dataclass
class SignalHit:
    signal_type: str
    ticker: str | None
    cik: str | None
    headline: str
    rationale: str
    confidence: float           # 0.0 - 1.0
    asymmetry: float            # expected_upside / expected_downside
    catalyst_date: date | None = None
    accession: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_db(self) -> dict[str, Any]:
        return {
            "signal_type": self.signal_type,
            "ticker": self.ticker,
            "cik": self.cik,
            "accession": self.accession,
            "catalyst_date": self.catalyst_date.isoformat()
                if self.catalyst_date else None,
            "confidence": self.confidence,
            "asymmetry": self.asymmetry,
            "headline": self.headline,
            "rationale": self.rationale,
            "metadata": self.metadata,
        }


class Signal:
    """Subclass and implement `detect`."""
    name: str = "base"

    def __init__(self, edgar: EdgarClient, store: Store, llm: Any | None = None,
                 cfg: dict[str, Any] | None = None):
        self.edgar = edgar
        self.store = store
        self.llm = llm
        self.cfg = cfg or {}

    def detect(self) -> Iterable[SignalHit]:
        raise NotImplementedError

    def run(self) -> list[SignalHit]:
        try:
            hits = list(self.detect())
        except Exception:  # noqa: BLE001
            log.exception("signal %s failed", self.name)
            return []
        for h in hits:
            self.store.insert_signal(**h.to_db())
        log.info("signal %s produced %d hits", self.name, len(hits))
        return hits
