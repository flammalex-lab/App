"""Activist 13D coattails event study.

Methodology:
- For each documented activist campaign, approximate the 13D announcement
  date as month-end (real 13Ds trigger a 5-calendar-day filing window, so
  this adds a little noise; good enough for a first-order study).
- Measure forward returns from the announcement month vs. SPY/IWM.
- Separate by filer size tier and target size tier.

Caveat: curated list contains campaigns where we remember them —
survivorship-ish bias. In production we would pull all 13Ds from
EDGAR by whitelist CIK and tickers lookup programmatically.
"""
from __future__ import annotations

import csv
import logging
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from alpha.backtest.spinoff_study import _fetch_prices, HOLDING_WINDOWS_DAYS, BENCHMARKS

log = logging.getLogger("alpha.backtest.activist")


def _approx_announcement_date(ticker: str, year: int, month: int) -> date | None:
    """First trading day of that month for the target."""
    window_start = date(year, month, 1)
    nm = month + 1
    ny = year
    if nm > 12:
        nm = 1
        ny += 1
    window_end = date(ny, nm, 1)
    px = _fetch_prices(ticker, window_start, window_end)
    if px is None or px.empty:
        return None
    return px.index[0].date()


def _forward_returns(px: pd.Series, ann_date: date) -> dict[str, Optional[float]]:
    px = px.sort_index()
    ann_ts = pd.Timestamp(ann_date)
    entry_ix = px.index.searchsorted(ann_ts)
    if entry_ix >= len(px):
        return {k: None for k in HOLDING_WINDOWS_DAYS}
    entry_px = float(px.iloc[entry_ix])
    out: dict[str, Optional[float]] = {}
    for label, days in HOLDING_WINDOWS_DAYS.items():
        tgt = entry_ix + days
        if tgt >= len(px):
            out[label] = None
            continue
        out[label] = float(px.iloc[tgt]) / entry_px - 1 if entry_px > 0 else None
    return out


def run_study(csv_path: Path, pause_s: float = 0.4) -> pd.DataFrame:
    events: list[dict] = []
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            events.append(row)

    log.info("Running activist study for %d campaigns", len(events))

    years = sorted({int(e["campaign_year"]) for e in events})
    benches: dict[str, pd.Series] = {}
    for b in BENCHMARKS:
        s = _fetch_prices(b, date(min(years) - 1, 1, 1),
                          date(max(years) + 3, 12, 31), pause_s=pause_s)
        if s is not None:
            benches[b] = s
        time.sleep(pause_s)

    rows: list[dict] = []
    for ev in events:
        tgt = ev["target_ticker"]
        filer = ev["filer"]
        tier = ev["size_tier"]
        y, m = int(ev["campaign_year"]), int(ev["campaign_month"])
        ann = _approx_announcement_date(tgt, y, m)
        if ann is None:
            log.warning("no price data for %s around %d-%d", tgt, y, m)
            continue

        px = _fetch_prices(tgt, ann - timedelta(days=5),
                           ann + timedelta(days=800), pause_s=pause_s)
        if px is None or px.empty:
            continue
        tgt_rets = _forward_returns(px, ann)
        bench_rets = {b: _forward_returns(bpx, ann) for b, bpx in benches.items()}

        row = {"target": tgt, "filer": filer, "ann_date": ann.isoformat(),
               "size_tier": tier}
        for k, v in tgt_rets.items():
            row[f"target_{k}"] = v
        for b, brets in bench_rets.items():
            for k, v in brets.items():
                row[f"{b}_{k}"] = v
                tv = tgt_rets.get(k)
                row[f"excess_{b}_{k}"] = (tv - v) if (tv is not None and v is not None) else None
        rows.append(row)
        time.sleep(pause_s)

    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    if df.empty:
        return {}
    out: dict[str, pd.DataFrame] = {}
    windows = list(HOLDING_WINDOWS_DAYS.keys())

    agg_rows: list[dict] = []
    for w in windows:
        vals = df[f"target_{w}"].dropna()
        if vals.empty:
            continue
        ex_iwm = df[f"excess_IWM_{w}"].dropna()
        ex_spy = df[f"excess_SPY_{w}"].dropna()
        agg_rows.append({
            "window": w, "n": len(vals),
            "mean_return": vals.mean(),
            "median_return": vals.median(),
            "hit_rate_pos": (vals > 0).mean(),
            "excess_vs_IWM_mean": ex_iwm.mean() if len(ex_iwm) else np.nan,
            "excess_vs_IWM_hit": (ex_iwm > 0).mean() if len(ex_iwm) else np.nan,
            "excess_vs_SPY_mean": ex_spy.mean() if len(ex_spy) else np.nan,
            "beat_IWM_by_10pct+": (ex_iwm > 0.10).mean() if len(ex_iwm) else np.nan,
        })
    out["aggregate"] = pd.DataFrame(agg_rows)

    tier_rows: list[dict] = []
    for tier, grp in df.groupby("size_tier"):
        for w in windows:
            vals = grp[f"target_{w}"].dropna()
            ex_iwm = grp[f"excess_IWM_{w}"].dropna()
            if vals.empty:
                continue
            tier_rows.append({
                "size_tier": tier, "window": w, "n": len(vals),
                "mean_return": vals.mean(),
                "excess_vs_IWM_mean": ex_iwm.mean() if len(ex_iwm) else np.nan,
                "hit_rate_pos": (vals > 0).mean(),
            })
    out["by_size_tier"] = pd.DataFrame(tier_rows)
    return out
