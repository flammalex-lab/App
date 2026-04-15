#!/usr/bin/env python3
"""Run the historical spin-off event study and dump results."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import pandas as pd

from alpha.backtest.spinoff_study import run_study, summarize
from alpha.config import DATA_DIR

CSV_PATH = DATA_DIR / "historical_spinoffs.csv"


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Two passes: enter on ex_date (T+0), and wait out 21 days (T+21)
    frames: dict[str, pd.DataFrame] = {}
    for label, offset in [("T+0", 0), ("T+21", 21)]:
        logging.info("=== Entry strategy: %s ===", label)
        df = run_study(CSV_PATH, entry_offset_days=offset)
        df["entry_strategy"] = label
        frames[label] = df

    combined = pd.concat(frames.values(), ignore_index=True)
    out_dir = DATA_DIR / "backtest"
    out_dir.mkdir(parents=True, exist_ok=True)
    combined.to_csv(out_dir / "spinoff_events.csv", index=False)

    # Summaries per strategy
    md_lines = ["# Spin-off Event Study Results", ""]
    for label, df in frames.items():
        md_lines += [f"## Entry strategy: {label}", ""]
        if df.empty:
            md_lines += ["_No events completed — check network / ticker availability._", ""]
            continue
        sm = summarize(df)
        md_lines += ["### Aggregate returns by holding window", ""]
        md_lines += [sm["aggregate"].round(4).to_markdown(index=False), ""]
        md_lines += ["### By size tier", ""]
        md_lines += [sm["by_size_tier"].round(4).to_markdown(index=False), ""]
        # Per-event raw returns
        cols = ["newco", "parent", "ex_date", "size_tier",
                "newco_12m", "excess_IWM_12m", "newco_24m", "excess_IWM_24m"]
        avail = [c for c in cols if c in df.columns]
        md_lines += ["### Per-event detail (12m / 24m)", ""]
        md_lines += [df[avail].round(3).to_markdown(index=False), ""]

    report_path = out_dir / "spinoff_study.md"
    report_path.write_text("\n".join(md_lines))
    logging.info("Wrote %s", report_path)
    print(report_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
