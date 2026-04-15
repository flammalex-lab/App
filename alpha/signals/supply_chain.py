"""Supply-chain co-movement graph (original).

Signal rationale:
    Every 10-K must disclose "significant customers" (typically any single
    customer >10% of revenue, per ASC 280). These disclosures build a
    directed graph of economic dependencies that is unambiguously public but
    effectively unused by non-quant market participants.

    Cohen & Frazzini (2008) "Economic Links and Predictable Returns" showed
    that customer-firm news predicts supplier-firm returns with a lag — a
    well-documented inefficiency driven by limited investor attention.

Implementation:
    - Parse customer/supplier mentions from 10-K risk factors and the MD&A.
    - Build a directed graph (supplier -> customer).
    - When a customer firm has a significant event (pre-announcement,
      guidance change, 13D), flag all suppliers in the sub-graph.

This module bootstraps the edge table from 10-K extractions (LLM-assisted)
and then emits signals when events cascade through the graph.
"""
from __future__ import annotations

import sqlite3
from datetime import date, timedelta
from typing import Iterable

from alpha.edgar.forms import FormType
from alpha.signals.base import Signal, SignalHit


class SupplyChainSignal(Signal):
    name = "supply_chain_cascade"

    def detect(self) -> Iterable[SignalHit]:
        window = int(self.cfg.get("event_window_days", 5))
        start = date.today() - timedelta(days=window)

        # 1. Ingest new 10-Ks and extract customer/supplier mentions.
        for filing in self.edgar.filings_for([FormType.TEN_K], start=start):
            cached = self.store.get_extraction(filing.accession, "supply_chain_v1")
            if cached is None and self.llm is not None:
                doc = self.edgar.download_primary_document(filing)
                extracted = self.llm.extract_supply_chain(filing, doc) or {}
                for edge in extracted.get("edges", []):
                    self.store.upsert_edge({
                        "src_cik": filing.cik,
                        "dst_cik": edge.get("counterparty_cik", ""),
                        "src_name": filing.company,
                        "dst_name": edge.get("counterparty_name", ""),
                        "relation": edge.get("relation", "customer"),
                        "confidence": edge.get("confidence", 0.7),
                        "first_seen": filing.filed.isoformat(),
                        "last_seen": filing.filed.isoformat(),
                    })

        # 2. Find recent "event" signals (activist, insider cluster, 8-K) and
        #    cascade to upstream suppliers.
        with self.store.conn() as c:
            # Get recent high-confidence signals; treat their subjects as "event nodes"
            events = list(c.execute(
                """
                SELECT DISTINCT cik, ticker, headline
                FROM signals
                WHERE detected_at >= datetime('now', ?)
                  AND confidence >= 0.7
                  AND signal_type IN ('activist_13d','capital_allocator_regime')
                """,
                (f"-{window} days",),
            ))
            for ev in events:
                upstream = list(c.execute(
                    """
                    SELECT src_cik, src_name FROM supply_chain_edges
                    WHERE dst_cik=? AND relation='customer'
                    """,
                    (ev["cik"],),
                ))
                for up in upstream:
                    yield SignalHit(
                        signal_type=self.name,
                        ticker=None,
                        cik=up["src_cik"],
                        headline=(
                            f"Supply-chain cascade: {up['src_name']} is supplier "
                            f"to event subject {ev['ticker'] or ev['cik']}"
                        ),
                        rationale=(
                            f"Upstream supplier of a firm with a recent "
                            f"high-confidence signal ({ev['headline']}). "
                            "Cohen-Frazzini documented persistent "
                            "customer-to-supplier return predictability from "
                            "limited investor attention."
                        ),
                        confidence=0.55,
                        asymmetry=2.0,
                        metadata={"event_cik": ev["cik"]},
                    )
