#!/usr/bin/env python3
"""Run the microcap negative-EV backtest.

First run is slow (~15-30 min) because of Company Facts fetches + yfinance
history. All fundamentals are cached on disk; subsequent runs are fast.

Usage:
    # MVP — sample 200 CIKs, 8 quarters
    python scripts/backtest_microcap.py --sample 200 --start 2020 --end 2021

    # Full run
    python scripts/backtest_microcap.py --start 2015 --end 2023
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import pandas as pd

from alpha.config import DATA_DIR
from alpha.edgar import EdgarClient
from alpha.experimental.microcap.backtest import (
    hits_to_dataframe, quarterly_screen_dates, run_walk_forward, summarize,
)
from alpha.experimental.microcap.universe import load_universe


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=2019)
    ap.add_argument("--end", type=int, default=2022)
    ap.add_argument("--sample", type=int, default=None,
                    help="Max CIKs to scan (for speed). Default: all.")
    ap.add_argument("--shuffle", action="store_true",
                    help="Shuffle universe before sampling (essential: "
                         "first N CIKs are megacaps).")
    ap.add_argument("--seed", type=int, default=42,
                    help="Random seed for shuffle (reproducibility).")
    ap.add_argument("--out-dir", type=Path,
                    default=DATA_DIR / "backtest" / "microcap")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    edgar = EdgarClient()
    universe = load_universe(edgar)
    if args.shuffle:
        import random
        rnd = random.Random(args.seed)
        rnd.shuffle(universe)
        logging.info("Universe shuffled (seed=%d)", args.seed)
    dates = quarterly_screen_dates(args.start, args.end)
    logging.info("Screen dates: %d quarters from %d to %d",
                 len(dates), args.start, args.end)

    hits = run_walk_forward(
        edgar, universe, dates, n_sample=args.sample,
    )
    logging.info("Total hits: %d", len(hits))

    args.out_dir.mkdir(parents=True, exist_ok=True)
    df = hits_to_dataframe(hits)
    df.to_csv(args.out_dir / "microcap_hits.csv", index=False)

    md = [f"# Microcap Negative-EV Walk-Forward — {args.start}..{args.end}", ""]
    if args.sample:
        md.append(f"**Sampled universe: {args.sample} CIKs** "
                   "(scale up after MVP validates pipeline)")
        md.append("")
    if df.empty:
        md += ["_No hits returned. Either the screen is too strict, the",
               "universe too small, or the pipeline has a bug._"]
    else:
        sm = summarize(df)
        md += ["## Aggregate forward-return stats", "",
               sm.round(4).to_markdown(index=False), ""]
        md += ["## Top hits (by discount to net cash)", ""]
        cols = ["ticker", "as_of", "market_cap_usd", "ev_usd",
                "discount_to_net_cash", "ocf_3y_usd",
                "ret_12m", "ret_24m", "excess_iwm_12m", "excess_iwm_24m"]
        avail = [c for c in cols if c in df.columns]
        top = df.sort_values("discount_to_net_cash", ascending=False).head(30)
        md += [top[avail].round(3).to_markdown(index=False), ""]
    out_md = args.out_dir / "microcap_report.md"
    out_md.write_text("\n".join(md))
    logging.info("Wrote %s", out_md)
    print(out_md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
