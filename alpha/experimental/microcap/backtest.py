"""Walk-forward backtest for the negative-EV microcap strategy.

Per screen date:
  1. For each CIK in the universe:
     a. Compute market cap at the date (via yfinance adjusted close × XBRL shares).
     b. Apply the screen.
  2. Collect pass-list.
  3. Simulate equal-weight buy at the screen date, hold 24m.
  4. Compute forward returns, benchmark vs IWM.

The MVP runs on a limited universe (n_sample) and a few screen dates
to validate the pipeline in ~10 minutes before scaling up.

Caching:
  - Company Facts JSON is cached by EDGAR client (on disk).
  - yfinance price history is pulled once per ticker, per run.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable

import numpy as np
import pandas as pd

from alpha.experimental.microcap.fundamentals import fetch_fundamentals
from alpha.experimental.microcap.screener import screen_at_date, ScreenResult
from alpha.experimental.microcap.universe import UniverseEntry

log = logging.getLogger("alpha.microcap.backtest")


HOLD_WINDOWS_DAYS = {"6m": 126, "12m": 252, "18m": 378, "24m": 504}


@dataclass
class ScreenHit:
    cik: str
    ticker: str
    name: str
    as_of: date
    market_cap_usd: float
    net_cash_usd: float
    ev_usd: float
    ocf_3y_usd: float
    forward_returns: dict[str, float | None] = field(default_factory=dict)
    benchmark_returns: dict[str, float | None] = field(default_factory=dict)


def _fetch_history(ticker: str, start: date, end: date,
                    pause_s: float = 0.1) -> pd.Series | None:
    """Adjusted-close series via yfinance."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        df = yf.download(
            ticker, start=start.isoformat(), end=end.isoformat(),
            progress=False, auto_adjust=True, threads=False,
        )
    except Exception as e:  # noqa: BLE001
        log.debug("yf fetch failed for %s: %s", ticker, e)
        return None
    if df is None or df.empty:
        return None
    col = "Close" if "Close" in df.columns else df.columns[0]
    series = df[col].dropna()
    if isinstance(series, pd.DataFrame):
        series = series.iloc[:, 0]
    series.index = pd.to_datetime(series.index).tz_localize(None)
    return series


def _price_near_date(px: pd.Series, target: date,
                      lookback_days: int = 10) -> float | None:
    """Price on or just before `target`. Returns None if no bar within
    lookback_days."""
    target_ts = pd.Timestamp(target)
    idx = px.index.searchsorted(target_ts, side="right") - 1
    if idx < 0:
        return None
    bar_date = px.index[idx]
    if (target - bar_date.date()).days > lookback_days:
        return None
    return float(px.iloc[idx])


def _forward_returns_from(px: pd.Series, entry_date: date
                           ) -> dict[str, float | None]:
    px = px.sort_index()
    entry_ts = pd.Timestamp(entry_date)
    entry_ix = px.index.searchsorted(entry_ts)
    if entry_ix >= len(px):
        return {k: None for k in HOLD_WINDOWS_DAYS}
    entry_px = float(px.iloc[entry_ix])
    out: dict[str, float | None] = {}
    for label, days in HOLD_WINDOWS_DAYS.items():
        tgt = entry_ix + days
        if tgt >= len(px) or entry_px <= 0:
            out[label] = None
            continue
        out[label] = float(px.iloc[tgt]) / entry_px - 1
    return out


def screen_cik_at_date(edgar, cik: str, ticker: str, as_of: date,
                        price_cache: dict) -> ScreenResult | None:
    """Fetch fundamentals, compute market cap, apply screen. Returns
    None if data is unavailable."""
    fund = fetch_fundamentals(edgar, cik)
    if fund is None:
        return None

    # Resolve shares outstanding closest to `as_of`
    shares_pt = fund.latest_before("shares_outstanding", as_of,
                                     max_age_days=400)
    if shares_pt is None or shares_pt.value <= 0:
        return None

    # Resolve price from yfinance — cache the history per ticker
    if ticker not in price_cache:
        hist = _fetch_history(
            ticker,
            date(2014, 1, 1), date(2025, 6, 30),
        )
        price_cache[ticker] = hist
    px = price_cache.get(ticker)
    if px is None or px.empty:
        return None
    p = _price_near_date(px, as_of)
    if p is None or p <= 0:
        return None

    market_cap = shares_pt.value * p
    return screen_at_date(fund, as_of, market_cap)


def run_walk_forward(
    edgar,
    universe: list[UniverseEntry],
    screen_dates: list[date],
    *,
    n_sample: int | None = None,
    fetch_pause_s: float = 0.1,
) -> list[ScreenHit]:
    if n_sample:
        universe = universe[:n_sample]
    log.info("Scanning %d CIKs over %d screen dates...",
             len(universe), len(screen_dates))

    # Pre-fetch IWM benchmark once
    iwm_hist = _fetch_history(
        "IWM", min(screen_dates) - timedelta(days=10),
        max(screen_dates) + timedelta(days=800),
    )

    price_cache: dict[str, pd.Series | None] = {}
    hits: list[ScreenHit] = []

    for i, entry in enumerate(universe):
        if i and i % 100 == 0:
            log.info("  ...%d/%d CIKs scanned, %d hits so far",
                      i, len(universe), len(hits))

        # Fetch fundamentals ONCE per CIK (not per screen date)
        try:
            fund = fetch_fundamentals(edgar, entry.cik)
        except Exception:  # noqa: BLE001
            fund = None
        if fund is None:
            continue

        # Fetch price history ONCE per ticker
        if entry.ticker not in price_cache:
            price_cache[entry.ticker] = _fetch_history(
                entry.ticker, date(2014, 1, 1), date(2025, 6, 30),
            )
        px = price_cache.get(entry.ticker)
        if px is None or px.empty:
            continue

        # Now screen across all dates using the in-memory data
        for as_of in screen_dates:
            shares_pt = fund.latest_before("shares_outstanding", as_of,
                                             max_age_days=400)
            if shares_pt is None or shares_pt.value <= 0:
                continue
            p = _price_near_date(px, as_of)
            if p is None or p <= 0:
                continue
            market_cap = shares_pt.value * p

            from alpha.experimental.microcap.screener import screen_at_date
            res = screen_at_date(fund, as_of, market_cap)
            if not res.pass_filter:
                continue

            frets = _forward_returns_from(px, as_of)
            brets = (_forward_returns_from(iwm_hist, as_of)
                     if iwm_hist is not None else {})
            hits.append(ScreenHit(
                cik=entry.cik, ticker=entry.ticker, name=entry.name,
                as_of=as_of, market_cap_usd=res.market_cap_usd,
                net_cash_usd=res.net_cash_usd, ev_usd=res.ev_usd,
                ocf_3y_usd=res.ocf_3y_usd,
                forward_returns=frets,
                benchmark_returns=brets,
            ))
            log.info(
                "  HIT %s @ %s: mcap=$%.0fM, EV=$%.0fM, disc=%.0f%%",
                entry.ticker, as_of,
                res.market_cap_usd / 1e6, res.ev_usd / 1e6,
                -res.ev_usd / res.market_cap_usd * 100,
            )
        # gentle sleep between CIKs
        time.sleep(fetch_pause_s)

    return hits


def hits_to_dataframe(hits: list[ScreenHit]) -> pd.DataFrame:
    rows = []
    for h in hits:
        r = {
            "cik": h.cik, "ticker": h.ticker, "name": h.name,
            "as_of": h.as_of.isoformat(),
            "market_cap_usd": h.market_cap_usd,
            "net_cash_usd": h.net_cash_usd,
            "ev_usd": h.ev_usd,
            "discount_to_net_cash": (
                -h.ev_usd / h.market_cap_usd if h.market_cap_usd else None
            ),
            "ocf_3y_usd": h.ocf_3y_usd,
        }
        for k, v in h.forward_returns.items():
            r[f"ret_{k}"] = v
        for k, v in h.benchmark_returns.items():
            r[f"iwm_{k}"] = v
            rv = h.forward_returns.get(k)
            r[f"excess_iwm_{k}"] = (
                rv - v if rv is not None and v is not None else None
            )
        rows.append(r)
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    out_rows = []
    for w in HOLD_WINDOWS_DAYS:
        col = f"ret_{w}"
        vals = df[col].dropna()
        if vals.empty:
            continue
        ex = df[f"excess_iwm_{w}"].dropna()
        out_rows.append({
            "window": w,
            "n": len(vals),
            "mean_return": vals.mean(),
            "median_return": vals.median(),
            "hit_rate_pos": (vals > 0).mean(),
            "excess_vs_iwm_mean": ex.mean() if len(ex) else np.nan,
            "excess_vs_iwm_median": ex.median() if len(ex) else np.nan,
            "best": vals.max(),
            "worst": vals.min(),
        })
    return pd.DataFrame(out_rows)


def quarterly_screen_dates(start_year: int, end_year: int) -> list[date]:
    """Quarter-end dates, shifted to last business day (approx)."""
    months = [(3, 31), (6, 30), (9, 30), (12, 31)]
    out: list[date] = []
    for y in range(start_year, end_year + 1):
        for m, d in months:
            out.append(date(y, m, d))
    return out
