#!/usr/bin/env python3
"""Walk-forward system-level backtest runner.

Usage:
    python scripts/walk_forward.py --start 2022-01-01 --end 2023-12-31
    python scripts/walk_forward.py --start 2015-01-01 --end 2024-12-31 \
                                   --skip-activists

The "short sanity" window (2022-2023) completes in ~15 min.
The full 10-year window takes a few hours due to price fetching.
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

from alpha.backtest.replay import (
    TickerResolver, replay_spinoffs, replay_activists,
    results_to_df, summarize, precision_vs_curated, BENCHMARKS,
)
from alpha.backtest.spinoff_study import _fetch_prices
from alpha.config import DATA_DIR
from alpha.edgar import EdgarClient


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def render_markdown(
    spin_df: pd.DataFrame,
    act_df: pd.DataFrame,
    spin_sm: dict[str, pd.DataFrame],
    act_sm: dict[str, pd.DataFrame],
    spin_precision: dict,
    start: date,
    end: date,
) -> str:
    L = [f"# Walk-Forward System Backtest — {start} to {end}", ""]
    L += ["This test replays the EDGAR filing stream as it was available at",
          "each point in time. No curated lists, no hindsight selection.", ""]

    L += ["## Spin-off pipeline (Form 10-12B)", ""]
    if not spin_df.empty and "coverage" in spin_sm:
        L += ["### Coverage", ""]
        L += [spin_sm["coverage"].to_markdown(index=False), ""]
    if "aggregate" in spin_sm:
        L += ["### Returns (tradeable events only)", ""]
        L += [spin_sm["aggregate"].round(4).to_markdown(index=False), ""]
    if "return_distribution_12m" in spin_sm:
        L += ["### 12-month return distribution", ""]
        L += [spin_sm["return_distribution_12m"].to_markdown(index=False), ""]
    if "by_cohort_year" in spin_sm:
        L += ["### By cohort year", ""]
        L += [spin_sm["by_cohort_year"].round(4).to_markdown(index=False), ""]
    if spin_precision:
        L += ["### Recall vs curated winner list", ""]
        for k, v in spin_precision.items():
            L += [f"- **{k}**: {v}"]
        L += [""]

    L += ["## Activist 13D pipeline (whitelist only)", ""]
    if not act_df.empty and "coverage" in act_sm:
        L += ["### Coverage", ""]
        L += [act_sm["coverage"].to_markdown(index=False), ""]
    if "aggregate" in act_sm:
        L += ["### Returns (tradeable events only)", ""]
        L += [act_sm["aggregate"].round(4).to_markdown(index=False), ""]
    if "return_distribution_12m" in act_sm:
        L += ["### 12-month return distribution", ""]
        L += [act_sm["return_distribution_12m"].to_markdown(index=False), ""]
    if "by_cohort_year" in act_sm:
        L += ["### By cohort year", ""]
        L += [act_sm["by_cohort_year"].round(4).to_markdown(index=False), ""]

    L += ["## Interpretation", "",
          "- Coverage rows tell you how many filings survived CIK→ticker",
          "  resolution. Low resolution pct = many companies were later",
          "  renamed/acquired and don't appear in SEC's current-snapshot JSON.",
          "- `mean_net_of_costs` applies a flat 50 bps round-trip cost.",
          "- `excess_vs_IWM_*` is the honest number for a small-cap tilted strategy.",
          "- `return_distribution_12m` shows tail risk: how many positions",
          "  experienced >50% drawdowns."]
    return "\n".join(L)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=parse_date, default=date(2022, 1, 1))
    ap.add_argument("--end", type=parse_date, default=date(2023, 12, 31))
    ap.add_argument("--skip-spinoffs", action="store_true")
    ap.add_argument("--skip-activists", action="store_true")
    ap.add_argument("--max-events", type=int, default=None,
                     help="Cap events per pipeline (sanity testing).")
    ap.add_argument("--entry-delay", type=int, default=21)
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    edgar = EdgarClient()
    resolver = TickerResolver(edgar)

    # Pre-fetch benchmarks once
    logging.info("Fetching benchmarks...")
    benches = {}
    for b in BENCHMARKS:
        s = _fetch_prices(
            b, args.start - timedelta(days=5),
            args.end + timedelta(days=800),
        )
        if s is not None:
            benches[b] = s

    spin_df = pd.DataFrame()
    act_df = pd.DataFrame()
    spin_sm: dict = {}
    act_sm: dict = {}
    spin_precision: dict = {}

    if not args.skip_spinoffs:
        logging.info("=== Replaying spin-offs ===")
        spin_results = replay_spinoffs(
            edgar, resolver, benches, args.start, args.end,
            entry_delay_trading_days=args.entry_delay,
            max_events=args.max_events,
        )
        spin_df = results_to_df(spin_results)
        spin_sm = summarize(spin_df)
        curated = DATA_DIR / "historical_spinoffs.csv"
        if curated.exists():
            spin_precision = precision_vs_curated(spin_df, curated)

    if not args.skip_activists:
        logging.info("=== Replaying activists ===")
        act_results = replay_activists(
            edgar, resolver, benches, args.start, args.end,
            max_events=args.max_events,
        )
        act_df = results_to_df(act_results)
        act_sm = summarize(act_df)

    out_dir = DATA_DIR / "backtest" / f"walk_forward_{args.start}_{args.end}"
    out_dir.mkdir(parents=True, exist_ok=True)
    if not spin_df.empty:
        spin_df.to_csv(out_dir / "spinoff_events.csv", index=False)
    if not act_df.empty:
        act_df.to_csv(out_dir / "activist_events.csv", index=False)

    md = render_markdown(spin_df, act_df, spin_sm, act_sm, spin_precision,
                         args.start, args.end)
    report_path = out_dir / "walk_forward_report.md"
    report_path.write_text(md)
    logging.info("Wrote %s", report_path)
    print(report_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
