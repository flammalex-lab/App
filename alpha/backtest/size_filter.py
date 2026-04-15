"""Size-at-entry filtering for walk-forward results.

Greenblatt's central spin-off claim: small spin-offs from big parents
outperform because they're 'too small to matter' to parent shareholders
who rotate out.

Without LLM extraction we can't easily get the parent-newco SIZE RATIO
from a Form 10. But we can use the newco's OWN market cap on its first
trading day as a proxy:

  newco_start_mcap = first_trade_close * shares_outstanding

A newco with a $500M day-1 mcap from a $50B parent is the textbook
Greenblatt setup. A newco with a $5B day-1 mcap is more likely a
proportional spin (less alpha).

This module enriches a walk-forward results CSV with newco_start_mcap
and bucketed analysis.

Caveats:
- yfinance shares_outstanding is current-snapshot. Approximate; some
  newcos issued more shares post-spin (acquisitions, buybacks).
- Where shares_outstanding is unavailable we fall back to estimating
  from average daily volume * 100, which is rough.
"""
from __future__ import annotations

import logging
import time
from datetime import date
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

log = logging.getLogger("alpha.backtest.size_filter")


def get_newco_start_mcap(ticker: str, first_trade: date,
                         pause_s: float = 0.3) -> Optional[float]:
    """Approximate market cap on the first trading day."""
    try:
        t = yf.Ticker(ticker)
        # Try shares_outstanding from info
        info = {}
        try:
            info = t.get_info()  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            try:
                info = t.info
            except Exception:  # noqa: BLE001
                pass
        shares = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding")
        if not shares:
            # Fall back to get_shares() time series
            try:
                shares_df = t.get_shares_full(
                    start=first_trade.isoformat(),
                    end=(first_trade.replace(month=min(12, first_trade.month + 3))
                         if first_trade.month <= 9 else date(first_trade.year + 1,
                                                              first_trade.month - 9,
                                                              1)).isoformat(),
                )
                if shares_df is not None and not shares_df.empty:
                    shares = float(shares_df.iloc[0])
            except Exception:  # noqa: BLE001
                pass
        if not shares:
            return None
        # Get the first close
        h = t.history(start=first_trade.isoformat(),
                      end=(pd.Timestamp(first_trade) +
                           pd.Timedelta(days=10)).date().isoformat())
        if h.empty:
            return None
        first_close = float(h["Close"].iloc[0])
        return first_close * float(shares)
    except Exception as e:  # noqa: BLE001
        log.debug("mcap fetch failed for %s: %s", ticker, e)
        return None
    finally:
        time.sleep(pause_s)


def enrich_with_size(df: pd.DataFrame, pause_s: float = 0.3) -> pd.DataFrame:
    """Add newco_start_mcap and size_bucket columns."""
    df = df.copy()
    mcaps: list[Optional[float]] = []
    for _, row in df.iterrows():
        if not row.get("has_prices") or not row.get("ticker"):
            mcaps.append(None)
            continue
        ft = row.get("first_trade_date")
        if not ft or pd.isna(ft):
            mcaps.append(None)
            continue
        first_trade = pd.to_datetime(ft).date()
        mcaps.append(get_newco_start_mcap(row["ticker"], first_trade,
                                            pause_s=pause_s))
    df["newco_start_mcap"] = mcaps

    def bucket(v):
        if v is None or pd.isna(v):
            return "unknown"
        if v < 500_000_000:
            return "nano (<$500M)"
        if v < 2_000_000_000:
            return "small ($500M-$2B)"
        if v < 10_000_000_000:
            return "mid ($2B-$10B)"
        return "large (>$10B)"

    df["size_bucket"] = df["newco_start_mcap"].apply(bucket)
    return df


def summarize_by_size(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate returns by size bucket."""
    rows = []
    bucket_order = ["nano (<$500M)", "small ($500M-$2B)", "mid ($2B-$10B)",
                    "large (>$10B)", "unknown"]
    for bucket in bucket_order:
        grp = df[df["size_bucket"] == bucket]
        if grp.empty:
            continue
        for w in ["6m", "12m", "18m", "24m"]:
            col = f"ret_{w}"
            if col not in grp.columns:
                continue
            vals = grp[col].dropna()
            if vals.empty:
                continue
            ex_iwm = grp[f"excess_IWM_{w}"].dropna() if f"excess_IWM_{w}" in grp.columns else pd.Series(dtype=float)
            rows.append({
                "size_bucket": bucket,
                "window": w,
                "n": len(vals),
                "mean_return": vals.mean(),
                "median_return": vals.median(),
                "hit_rate": (vals > 0).mean(),
                "excess_vs_IWM_mean": ex_iwm.mean() if len(ex_iwm) else np.nan,
                "p25": vals.quantile(0.25),
                "p75": vals.quantile(0.75),
            })
    return pd.DataFrame(rows)
