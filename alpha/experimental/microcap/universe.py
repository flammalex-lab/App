"""Build the CIK universe for microcap screening.

For MVP, use SEC's company_tickers.json snapshot as the universe.
Filters out non-common-stock tickers (warrants, units, rights,
preferreds) that pollute the raw ~10K entries. After filtering, the
real common-stock universe is ~5-6K.

Limitation: this is a current-snapshot, so delisted names from
2015-2023 are absent (survivorship bias). In the current regime
that biases results UP (survivors did better than average); for
forward deployment the bias reverses because we see tomorrow's
survivors.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Iterator

log = logging.getLogger("alpha.microcap.universe")


# Patterns that indicate non-common-stock.
# Only applied to tickers with length >= 5 (4-char tickers like AAPL,
# NTIP, DAIO are overwhelmingly common stock).
_5CH_WARRANT_UNIT_SUFFIX = re.compile(r"(?:W|WS|U|UN|WT|RT|RI)$")
_5CH_PREFERRED_SUFFIX    = re.compile(r"(?:P|PR|PF)$")


def _is_common_stock(ticker: str) -> bool:
    """Best-effort filter. Rejects obvious warrants/units/rights/preferreds.

    Rules:
      - Length > 5 → pink sheets / unusual; reject.
      - Any '-' or '.' → Yahoo-style non-common (e.g., BRK-B, RITM-PF); reject.
      - Length >= 5 and ends in W/U/WS/WT/RT/RI → warrant/unit/right.
      - Length >= 5 and ends in P/PR/PF → preferred share.
      - Otherwise: treat as common.

    4-character tickers like AAPL, DAIO, NTIP are always treated as
    common; real 4-char warrants are rare and the false-positive
    cost is lower than rejecting real names.
    """
    if not ticker:
        return False
    t = ticker.strip().upper()
    if not t or len(t) > 5:
        return False
    if "-" in t or "." in t:
        return False
    if len(t) >= 5:
        if _5CH_WARRANT_UNIT_SUFFIX.search(t):
            return False
        if _5CH_PREFERRED_SUFFIX.search(t):
            return False
    return True


@dataclass
class UniverseEntry:
    cik: str
    ticker: str
    name: str


def load_universe(edgar, *, filter_common_only: bool = True
                   ) -> list[UniverseEntry]:
    url = "https://www.sec.gov/files/company_tickers.json"
    raw = edgar._get(url, host="www.sec.gov", use_cache=True)
    data = json.loads(raw)
    raw_out: list[UniverseEntry] = []
    for rec in data.values():
        cik = str(rec.get("cik_str", "")).zfill(10)
        ticker = rec.get("ticker", "")
        name = rec.get("title", "")
        if cik and ticker:
            raw_out.append(UniverseEntry(cik=cik, ticker=ticker, name=name))

    if not filter_common_only:
        log.info("Universe loaded (unfiltered): %d pairs", len(raw_out))
        return raw_out

    filtered = [e for e in raw_out if _is_common_stock(e.ticker)]
    log.info(
        "Universe loaded: %d pairs raw, %d after common-stock filter "
        "(removed %d warrants/units/preferreds)",
        len(raw_out), len(filtered), len(raw_out) - len(filtered),
    )
    return filtered
