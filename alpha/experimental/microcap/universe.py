"""Build the CIK universe for microcap screening.

For MVP, use SEC's company_tickers.json snapshot as the universe.
Limitation: this is a current-snapshot, so delisted names from
2015-2023 are absent (survivorship bias).

A more complete approach would be to iterate per-quarter SEC filing
indexes and union the CIKs that filed a 10-K in any quarter. That's
doable but ~2-3x slower. The current-snapshot is a reasonable MVP;
survivorship bias will UNDERSTATE how often the strategy flags
shell-like garbage, overstating returns. We flag this in findings.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Iterator

log = logging.getLogger("alpha.microcap.universe")


@dataclass
class UniverseEntry:
    cik: str
    ticker: str
    name: str


def load_universe(edgar) -> list[UniverseEntry]:
    url = "https://www.sec.gov/files/company_tickers.json"
    raw = edgar._get(url, host="www.sec.gov", use_cache=True)
    data = json.loads(raw)
    out: list[UniverseEntry] = []
    for rec in data.values():
        cik = str(rec.get("cik_str", "")).zfill(10)
        ticker = rec.get("ticker", "")
        name = rec.get("title", "")
        if cik and ticker:
            out.append(UniverseEntry(cik=cik, ticker=ticker, name=name))
    log.info("Universe loaded: %d CIK-ticker pairs", len(out))
    return out
