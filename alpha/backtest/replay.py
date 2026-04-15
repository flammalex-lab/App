"""Walk-forward SYSTEM-level backtest.

Unlike the curated event studies (which test *strategy* given known events),
this module tests the full detection pipeline: would the system have found
the winning events using only information available at each point in time?

Methodology:
1. For each year in the window, pull every Form 10-12B / SC 13D filing
   from EDGAR as they would have appeared.
2. Resolve filer CIK -> ticker via SEC company_tickers.json.
3. For each candidate, locate the ticker's earliest post-filing price
   series via yfinance.
4. Apply the system's entry rule (T+21 trading days after first trade).
5. Compute forward returns at 1m / 3m / 6m / 12m / 18m / 24m.
6. Compare to IWM/SPY benchmarks over the same windows.
7. Report:
   - N total filings flagged (raw detection count)
   - N with resolvable tickers (how many could actually be traded)
   - Mean/median return, hit rate, excess vs benchmark
   - Precision vs known-winner set (recall of curated list)

Biases this DOES eliminate (vs curated-list backtest):
  - Selection bias (we process every filing, not a remembered subset)
  - Look-ahead on size tier (classification uses filing metadata only)
  - Ticker resolution failures are counted honestly

Biases this DOES NOT fully eliminate:
  - Company_tickers.json is current-snapshot only (historical mergers/
    renames can mis-resolve). We flag unresolved filings but still
    include them in the denominator.
  - No transaction cost model beyond a flat 50 bps round-trip assumption
    in the summary. Micro-cap slippage in reality is higher.
  - yfinance adjusted closes reflect post-hoc dividend/split adjustment.
"""
from __future__ import annotations

import csv
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Optional

import httpx
import numpy as np
import pandas as pd

from alpha.backtest.spinoff_study import _fetch_prices, HOLDING_WINDOWS_DAYS
from alpha.config import DATA_DIR, activists as load_activists
from alpha.edgar import EdgarClient
from alpha.edgar.forms import FormType

log = logging.getLogger("alpha.backtest.replay")

BENCHMARKS = ["SPY", "IWM"]
COST_BPS_ROUNDTRIP = 50   # applied once per event in summary


# ---------------------------------------------------------------------------
# CIK <-> ticker resolution
# ---------------------------------------------------------------------------
class TickerResolver:
    """Resolve CIK -> ticker.

    Two-tier lookup:
      1. SEC's company_tickers.json (current-snapshot mapping; ~8k CIKs).
      2. Fallback to /submissions/CIK{cik}.json per company, which includes
         the historical ticker list — catching companies that were later
         renamed/acquired but still have their ticker in their submission
         history (`tickers` field).

    The per-CIK fallback is rate-limited but cached, so it's cheap on
    subsequent runs.
    """
    URL = "https://www.sec.gov/files/company_tickers.json"

    def __init__(self, edgar: EdgarClient):
        self.edgar = edgar
        self._cik_to_ticker: dict[str, str] = {}
        self._per_cik_cache: dict[str, str | None] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        raw = self.edgar._get(self.URL, host="www.sec.gov", use_cache=True)
        data = json.loads(raw)
        for rec in data.values():
            cik = str(rec.get("cik_str", "")).zfill(10)
            ticker = rec.get("ticker")
            if cik and ticker:
                self._cik_to_ticker[cik] = ticker
        self._loaded = True
        log.info("Ticker resolver loaded: %d CIKs (snapshot)",
                 len(self._cik_to_ticker))

    def lookup(self, cik: str) -> str | None:
        self._load()
        cik10 = str(cik).zfill(10)
        # Fast path: current-snapshot
        if cik10 in self._cik_to_ticker:
            return self._cik_to_ticker[cik10]
        # Slow path: per-CIK submissions JSON, cached
        if cik10 in self._per_cik_cache:
            return self._per_cik_cache[cik10]
        try:
            subs = self.edgar.company_submissions(cik10)
            tickers = subs.get("tickers", []) or []
            exchanges = subs.get("exchanges", []) or []
            # Prefer a non-warrant/non-unit ticker when multiple
            def _is_common(t: str, ex: str | None) -> int:
                if not t:
                    return 0
                # Drop obvious warrants / rights / units
                bad_suffix = ("W", "WS", "U", "UN", "R", "RT")
                if any(t.endswith(s) for s in bad_suffix) and len(t) > 3:
                    return 0
                return 1 if (ex or "").upper() not in ("", "OTC") else 1
            candidates = [
                (t, _is_common(t, exchanges[i] if i < len(exchanges) else None))
                for i, t in enumerate(tickers)
            ]
            ranked = sorted(candidates, key=lambda x: -x[1])
            ticker = ranked[0][0] if ranked and ranked[0][1] > 0 else None
        except Exception as e:  # noqa: BLE001
            log.debug("submissions fetch failed for %s: %s", cik10, e)
            ticker = None
        self._per_cik_cache[cik10] = ticker
        return ticker


# ---------------------------------------------------------------------------
# Forward return computation
# ---------------------------------------------------------------------------
@dataclass
class EventResult:
    signal_type: str
    cik: str
    ticker: str | None
    company: str
    filed_date: date
    first_trade_date: date | None
    entry_date: date | None
    resolved_ticker: bool
    has_prices: bool
    returns: dict[str, Optional[float]] = field(default_factory=dict)
    benchmark_excess: dict[str, dict[str, Optional[float]]] = field(default_factory=dict)
    notes: str = ""


def _forward_returns_from(
    px: pd.Series, entry_date: date
) -> dict[str, Optional[float]]:
    px = px.sort_index()
    entry_ts = pd.Timestamp(entry_date)
    entry_ix = px.index.searchsorted(entry_ts)
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


def _add_trading_days(d: date, n: int) -> date:
    cur = d
    added = 0
    while added < n:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


# ---------------------------------------------------------------------------
# Form 10 replay (spin-offs)
# ---------------------------------------------------------------------------
def replay_spinoffs(
    edgar: EdgarClient,
    resolver: TickerResolver,
    benches: dict[str, pd.Series],
    start: date,
    end: date,
    entry_delay_trading_days: int = 21,
    pause_s: float = 0.3,
    max_events: int | None = None,
) -> list[EventResult]:
    """Replay Form 10-12B filings. The filer CIK IS the newco."""
    results: list[EventResult] = []
    seen_ciks: set[str] = set()
    n = 0
    for filing in edgar.filings_for(
        [FormType.FORM_10, FormType.FORM_10_A], start=start, end=end,
    ):
        if max_events and n >= max_events:
            break
        # The same CIK can appear multiple times (amendments). Score only once.
        if filing.cik in seen_ciks:
            continue
        seen_ciks.add(filing.cik)

        ticker = resolver.lookup(filing.cik)
        res = EventResult(
            signal_type="spinoff",
            cik=filing.cik,
            ticker=ticker,
            company=filing.company,
            filed_date=filing.filed,
            first_trade_date=None,
            entry_date=None,
            resolved_ticker=bool(ticker),
            has_prices=False,
        )
        if not ticker:
            res.notes = "unresolved ticker"
            results.append(res)
            continue

        # Newco's price series post-filing
        px = _fetch_prices(
            ticker, filing.filed, filing.filed + timedelta(days=900),
            pause_s=pause_s,
        )
        if px is None or px.empty:
            res.notes = "no price data"
            results.append(res)
            continue
        res.has_prices = True
        res.first_trade_date = px.index[0].date()
        res.entry_date = _add_trading_days(res.first_trade_date,
                                             entry_delay_trading_days)

        res.returns = _forward_returns_from(px, res.entry_date)
        for b, bpx in benches.items():
            b_rets = _forward_returns_from(bpx, res.entry_date)
            res.benchmark_excess[b] = {
                k: (res.returns.get(k, None) - v) if
                   (res.returns.get(k) is not None and v is not None) else None
                for k, v in b_rets.items()
            }
        results.append(res)
        n += 1
        time.sleep(pause_s)
    return results


# ---------------------------------------------------------------------------
# 13D replay (activists)
# ---------------------------------------------------------------------------
def replay_activists(
    edgar: EdgarClient,
    resolver: TickerResolver,
    benches: dict[str, pd.Series],
    start: date,
    end: date,
    pause_s: float = 0.3,
    max_events: int | None = None,
) -> list[EventResult]:
    """Replay SC 13D filings where the FILER CIK is in our activist whitelist."""
    whitelist_ciks = [a["cik"].zfill(10) for a in load_activists()]
    log.info("Replaying 13Ds from %d whitelisted activists", len(whitelist_ciks))

    results: list[EventResult] = []
    seen: set[tuple[str, str]] = set()   # (subject_cik, filer_cik)
    n = 0

    # EFTS supports filtering by filer CIK. We iterate the whitelist and
    # pull each activist's historical 13Ds.
    for filer_cik in whitelist_ciks:
        if max_events and n >= max_events:
            break
        for hit in edgar.full_text_search(
            ["SC 13D", "SC 13D/A"], start=start, end=end,
            ciks=[filer_cik], max_pages=5,
        ):
            src = hit.get("_source", {})
            # The "ciks" array includes BOTH filer and subject. The subject
            # is typically NOT the filer CIK. We filter it out.
            all_ciks = [str(c).zfill(10) for c in src.get("ciks", [])]
            subject_ciks = [c for c in all_ciks if c != filer_cik.zfill(10)]
            if not subject_ciks:
                continue
            subj = subject_ciks[0]
            key = (subj, filer_cik)
            if key in seen:
                continue
            seen.add(key)

            ticker = resolver.lookup(subj)
            filed_s = src.get("file_date") or src.get("filing_date")
            try:
                from datetime import datetime as dt
                filed_d = dt.strptime(filed_s, "%Y-%m-%d").date()
            except (TypeError, ValueError):
                continue

            res = EventResult(
                signal_type="activist_13d",
                cik=subj,
                ticker=ticker,
                company=(src.get("display_names") or ["?"])[0],
                filed_date=filed_d,
                first_trade_date=None,
                entry_date=filed_d,
                resolved_ticker=bool(ticker),
                has_prices=False,
                notes=f"filer_cik={filer_cik}",
            )
            if not ticker:
                res.notes += " | unresolved"
                results.append(res)
                continue
            px = _fetch_prices(
                ticker, filed_d - timedelta(days=5),
                filed_d + timedelta(days=800), pause_s=pause_s,
            )
            if px is None or px.empty:
                res.notes += " | no price data"
                results.append(res)
                continue
            res.has_prices = True
            res.returns = _forward_returns_from(px, filed_d)
            for b, bpx in benches.items():
                b_rets = _forward_returns_from(bpx, filed_d)
                res.benchmark_excess[b] = {
                    k: (res.returns.get(k, None) - v) if
                       (res.returns.get(k) is not None and v is not None) else None
                    for k, v in b_rets.items()
                }
            results.append(res)
            n += 1
            if max_events and n >= max_events:
                break
            time.sleep(pause_s)
    return results


# ---------------------------------------------------------------------------
# Scoring / reporting
# ---------------------------------------------------------------------------
def results_to_df(results: list[EventResult]) -> pd.DataFrame:
    rows = []
    for r in results:
        row = {
            "signal_type": r.signal_type,
            "cik": r.cik,
            "ticker": r.ticker,
            "company": r.company,
            "filed_date": r.filed_date.isoformat() if r.filed_date else None,
            "first_trade_date": r.first_trade_date.isoformat()
                if r.first_trade_date else None,
            "entry_date": r.entry_date.isoformat() if r.entry_date else None,
            "resolved_ticker": r.resolved_ticker,
            "has_prices": r.has_prices,
            "notes": r.notes,
        }
        for k, v in r.returns.items():
            row[f"ret_{k}"] = v
        for b, exs in r.benchmark_excess.items():
            for k, v in exs.items():
                row[f"excess_{b}_{k}"] = v
        rows.append(row)
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame, cost_bps: int = COST_BPS_ROUNDTRIP
               ) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    if df.empty:
        return out

    coverage = pd.DataFrame([
        {"metric": "N filings flagged", "value": len(df)},
        {"metric": "N with resolved ticker",
         "value": int(df["resolved_ticker"].sum())},
        {"metric": "N with price data", "value": int(df["has_prices"].sum())},
        {"metric": "Pct tradeable",
         "value": round(df["has_prices"].mean(), 3)},
    ])
    out["coverage"] = coverage

    # Only tradeable events contribute to return stats
    trad = df[df["has_prices"]].copy()
    if trad.empty:
        return out

    windows = list(HOLDING_WINDOWS_DAYS.keys())
    agg_rows: list[dict] = []
    for w in windows:
        col = f"ret_{w}"
        vals = trad[col].dropna()
        if vals.empty:
            continue
        net = vals - cost_bps / 10_000   # apply round-trip cost
        ex_iwm = trad[f"excess_IWM_{w}"].dropna()
        ex_spy = trad[f"excess_SPY_{w}"].dropna()
        agg_rows.append({
            "window": w,
            "n": len(vals),
            "mean_gross": vals.mean(),
            "mean_net_of_costs": net.mean(),
            "median": vals.median(),
            "hit_rate_pos": (vals > 0).mean(),
            "excess_vs_IWM_mean": ex_iwm.mean() if len(ex_iwm) else np.nan,
            "excess_vs_IWM_median": ex_iwm.median() if len(ex_iwm) else np.nan,
            "excess_vs_IWM_hit": (ex_iwm > 0).mean() if len(ex_iwm) else np.nan,
            "excess_vs_SPY_mean": ex_spy.mean() if len(ex_spy) else np.nan,
            "p25": vals.quantile(0.25),
            "p75": vals.quantile(0.75),
        })
    out["aggregate"] = pd.DataFrame(agg_rows)

    # Distribution buckets — how many catastrophic losers?
    ret12 = trad.get("ret_12m", pd.Series(dtype=float)).dropna()
    if not ret12.empty:
        dist = pd.DataFrame([
            {"bucket": "<-50%", "n": int((ret12 < -0.5).sum())},
            {"bucket": "-50 to -20%", "n": int(((ret12 >= -0.5) & (ret12 < -0.2)).sum())},
            {"bucket": "-20 to 0%",  "n": int(((ret12 >= -0.2) & (ret12 < 0)).sum())},
            {"bucket": "0 to 20%",   "n": int(((ret12 >= 0) & (ret12 < 0.2)).sum())},
            {"bucket": "20 to 50%",  "n": int(((ret12 >= 0.2) & (ret12 < 0.5)).sum())},
            {"bucket": "50 to 100%", "n": int(((ret12 >= 0.5) & (ret12 < 1.0)).sum())},
            {"bucket": ">100%",      "n": int((ret12 >= 1.0).sum())},
        ])
        out["return_distribution_12m"] = dist

    # Year-by-year cohort returns at 12m
    df2 = trad.copy()
    df2["year"] = pd.to_datetime(df2["filed_date"]).dt.year
    yr = df2.groupby("year").agg(
        n=("cik", "count"),
        mean_12m=("ret_12m", "mean"),
        median_12m=("ret_12m", "median"),
        hit_12m=("ret_12m", lambda s: (s > 0).mean()),
    ).reset_index()
    out["by_cohort_year"] = yr
    return out


def precision_vs_curated(df: pd.DataFrame, curated_csv: Path,
                          ticker_col: str = "newco_ticker",
                          ) -> dict[str, float | int]:
    """What fraction of curated winners did the system find?"""
    with curated_csv.open() as f:
        curated_tickers = {row[ticker_col] for row in csv.DictReader(f)}
    flagged_tickers = set(df[df["has_prices"]]["ticker"].dropna())
    recall_n = len(curated_tickers & flagged_tickers)
    return {
        "curated_total": len(curated_tickers),
        "system_flagged_total": int(df["has_prices"].sum()),
        "both": recall_n,
        "recall_pct": round(recall_n / max(1, len(curated_tickers)), 3),
    }
