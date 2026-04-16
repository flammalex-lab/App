"""CIK -> ticker resolver with two-tier lookup.

Uses SEC's company_tickers.json snapshot first (fast), falls back to
per-CIK submissions JSON which contains historical ticker history
(catches companies that were later renamed/acquired).

This is the production-quality resolver used by both live scans and
backtests. See alpha.backtest.replay.TickerResolver for the ancestor
implementation.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache

log = logging.getLogger("alpha.spinoffs.ticker")

_SNAPSHOT_URL = "https://www.sec.gov/files/company_tickers.json"


class _Cache:
    snapshot_loaded: bool = False
    snapshot: dict[str, str] = {}
    per_cik: dict[str, str | None] = {}


_cache = _Cache()


def _load_snapshot(edgar) -> None:
    if _cache.snapshot_loaded:
        return
    raw = edgar._get(_SNAPSHOT_URL, host="www.sec.gov", use_cache=True)
    data = json.loads(raw)
    for rec in data.values():
        cik = str(rec.get("cik_str", "")).zfill(10)
        ticker = rec.get("ticker")
        if cik and ticker:
            _cache.snapshot[cik] = ticker
    _cache.snapshot_loaded = True
    log.info("Ticker snapshot loaded: %d CIKs", len(_cache.snapshot))


def resolve_ticker(edgar, cik: str) -> str | None:
    """Resolve a CIK to its current ticker.

    Returns None for delisted/renamed companies that don't appear in
    either the current snapshot or their own submission history.
    """
    cik10 = str(cik).zfill(10)
    _load_snapshot(edgar)
    if cik10 in _cache.snapshot:
        return _cache.snapshot[cik10]
    if cik10 in _cache.per_cik:
        return _cache.per_cik[cik10]
    try:
        subs = edgar.company_submissions(cik10)
        tickers = subs.get("tickers", []) or []
        exchanges = subs.get("exchanges", []) or []
        ticker = _pick_best_ticker(tickers, exchanges)
    except Exception as e:  # noqa: BLE001
        log.debug("submissions fetch failed for %s: %s", cik10, e)
        ticker = None
    _cache.per_cik[cik10] = ticker
    return ticker


def _pick_best_ticker(tickers: list[str], exchanges: list[str]) -> str | None:
    """Prefer common stock tickers over warrants/rights/units."""
    if not tickers:
        return None
    bad_suffixes = ("W", "WS", "U", "UN", "R", "RT")
    for i, t in enumerate(tickers):
        if not t:
            continue
        is_common = not (len(t) > 3 and any(t.endswith(s) for s in bad_suffixes))
        if is_common:
            return t
    return tickers[0]  # fallback
