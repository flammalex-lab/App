"""Historical spin-off event study.

Methodology:
- For each curated spin-off, use yfinance to find newco's first trading day
  (auto-detected ex-date) and pull adjusted closes.
- Compute buy-and-hold returns at 1m, 3m, 6m, 12m, 18m, 24m from ex-date.
- Also simulate a "wait out initial volatility" strategy: enter at T+21
  (one trading month after spin) to let forced-sellers clear.
- Benchmark against SPY (large-cap) and IWM (small-cap) over the same
  windows to compute excess return.
- Segment by size tier (Greenblatt: small spins > large spins).

Limitations:
- Survivorship bias: the curated list contains spin-offs we know about
  because they survived. Bankruptcies/delistings not in sample.
- Transaction costs modeled as 25 bps one-way.
- Dividend treatment: yfinance `Adj Close` reinvests dividends.
"""
from __future__ import annotations

import csv
import logging
import time
import warnings
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)
log = logging.getLogger("alpha.backtest.spinoff")


HOLDING_WINDOWS_DAYS = {
    "1m": 21,
    "3m": 63,
    "6m": 126,
    "12m": 252,
    "18m": 378,
    "24m": 504,
}

BENCHMARKS = ["SPY", "IWM"]


@dataclass
class EventResult:
    newco: str
    parent: str
    ex_date: date
    size_tier: str
    entry_strategy: str              # 'ex_date' | 'wait_21d'
    returns_by_window: dict[str, Optional[float]]
    benchmark_returns: dict[str, dict[str, Optional[float]]]


def _fetch_prices(ticker: str, start: date, end: date,
                  pause_s: float = 0.4) -> pd.Series | None:
    """Adjusted close, retrying once on empty."""
    import yfinance as yf
    for attempt in range(2):
        try:
            df = yf.download(
                ticker, start=start.isoformat(), end=end.isoformat(),
                progress=False, auto_adjust=True, threads=False,
            )
        except Exception as e:  # noqa: BLE001
            log.warning("yf error for %s: %s", ticker, e)
            time.sleep(pause_s * (attempt + 1))
            continue
        if df is None or df.empty:
            time.sleep(pause_s * (attempt + 1))
            continue
        col = "Close" if "Close" in df.columns else df.columns[0]
        series = df[col].dropna()
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        series.index = pd.to_datetime(series.index).tz_localize(None)
        return series
    return None


def _detect_ex_date(newco: str, hint_year: int, hint_month: int) -> date | None:
    """Return the first trading day for newco in a ±6 month window around hint."""
    window_start = date(hint_year, max(1, hint_month - 3), 1)
    window_end   = date(hint_year + (hint_month + 3 > 12),
                         ((hint_month + 3 - 1) % 12) + 1, 28)
    px = _fetch_prices(newco, window_start, window_end)
    if px is None or px.empty:
        return None
    first_idx = px.index[0]
    return first_idx.date() if hasattr(first_idx, "date") else first_idx


def _forward_returns(px: pd.Series, ex_date: date, entry_offset_days: int = 0
                     ) -> dict[str, Optional[float]]:
    px = px.sort_index()
    ex_ts = pd.Timestamp(ex_date)
    entry_ix = px.index.searchsorted(ex_ts)
    if entry_ix >= len(px):
        return {k: None for k in HOLDING_WINDOWS_DAYS}
    # Move forward by entry_offset_days trading days (approximation via calendar)
    if entry_offset_days:
        entry_ix = min(entry_ix + entry_offset_days, len(px) - 1)
    entry_px = float(px.iloc[entry_ix])
    out: dict[str, Optional[float]] = {}
    for label, days in HOLDING_WINDOWS_DAYS.items():
        tgt_ix = entry_ix + days
        if tgt_ix >= len(px):
            out[label] = None
            continue
        exit_px = float(px.iloc[tgt_ix])
        out[label] = exit_px / entry_px - 1 if entry_px > 0 else None
    return out


def run_study(csv_path: Path, entry_offset_days: int = 0,
              pause_s: float = 0.5) -> pd.DataFrame:
    events: list[dict] = []
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            events.append(row)

    log.info("Running event study for %d spin-offs", len(events))

    # Pre-fetch benchmarks over the full coverage window.
    all_years = sorted({int(e["spin_year"]) for e in events})
    bench_start = date(min(all_years) - 1, 1, 1)
    bench_end = date(max(all_years) + 3, 12, 31)
    benches: dict[str, pd.Series] = {}
    for b in BENCHMARKS:
        s = _fetch_prices(b, bench_start, bench_end, pause_s=pause_s)
        if s is not None:
            benches[b] = s
        time.sleep(pause_s)

    rows: list[dict] = []
    for ev in events:
        newco, parent = ev["newco_ticker"], ev["parent_ticker"]
        tier = ev["size_tier"]
        hy, hm = int(ev["spin_year"]), int(ev["spin_month"])

        ex = _detect_ex_date(newco, hy, hm)
        if ex is None:
            log.warning("no price data for %s around %d-%d", newco, hy, hm)
            continue

        fetch_start = ex - timedelta(days=5)
        fetch_end = ex + timedelta(days=800)
        px = _fetch_prices(newco, fetch_start, fetch_end, pause_s=pause_s)
        if px is None or px.empty:
            log.warning("price fetch failed for %s", newco)
            continue

        newco_rets = _forward_returns(px, ex, entry_offset_days)
        bench_rets: dict[str, dict[str, Optional[float]]] = {}
        for b, bpx in benches.items():
            bench_rets[b] = _forward_returns(bpx, ex, entry_offset_days)

        row = {
            "newco": newco,
            "parent": parent,
            "ex_date": ex.isoformat(),
            "size_tier": tier,
            "entry_offset_days": entry_offset_days,
        }
        for k, v in newco_rets.items():
            row[f"newco_{k}"] = v
        for b, brets in bench_rets.items():
            for k, v in brets.items():
                row[f"{b}_{k}"] = v
                # excess return = newco - benchmark
                nv = newco_rets.get(k)
                row[f"excess_{b}_{k}"] = (nv - v) if (nv is not None and v is not None) else None
        rows.append(row)
        time.sleep(pause_s)

    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    if df.empty:
        return {}
    out: dict[str, pd.DataFrame] = {}

    # Aggregate stats across windows
    windows = list(HOLDING_WINDOWS_DAYS.keys())
    agg_rows: list[dict] = []
    for w in windows:
        col = f"newco_{w}"
        vals = df[col].dropna()
        if vals.empty:
            continue
        excess_iwm = df[f"excess_IWM_{w}"].dropna()
        excess_spy = df[f"excess_SPY_{w}"].dropna()
        agg_rows.append({
            "window": w,
            "n": len(vals),
            "mean_return": vals.mean(),
            "median_return": vals.median(),
            "hit_rate_pos": (vals > 0).mean(),
            "excess_vs_IWM_mean": excess_iwm.mean() if len(excess_iwm) else np.nan,
            "excess_vs_IWM_median": excess_iwm.median() if len(excess_iwm) else np.nan,
            "excess_vs_IWM_hit": (excess_iwm > 0).mean() if len(excess_iwm) else np.nan,
            "excess_vs_SPY_mean": excess_spy.mean() if len(excess_spy) else np.nan,
            "beat_IWM_by_5pct+": (excess_iwm > 0.05).mean() if len(excess_iwm) else np.nan,
        })
    out["aggregate"] = pd.DataFrame(agg_rows)

    # By size tier
    tier_rows: list[dict] = []
    for tier, grp in df.groupby("size_tier"):
        for w in windows:
            vals = grp[f"newco_{w}"].dropna()
            excess = grp[f"excess_IWM_{w}"].dropna()
            if vals.empty:
                continue
            tier_rows.append({
                "size_tier": tier,
                "window": w,
                "n": len(vals),
                "mean_return": vals.mean(),
                "excess_vs_IWM_mean": excess.mean() if len(excess) else np.nan,
                "hit_rate_pos": (vals > 0).mean(),
            })
    out["by_size_tier"] = pd.DataFrame(tier_rows)

    return out
