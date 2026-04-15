#!/usr/bin/env python3
"""Run the historical activist 13D coattails study."""
from __future__ import annotations

import logging
import sys

import pandas as pd

from alpha.backtest.activist_study import run_study, summarize
from alpha.config import DATA_DIR

CSV_PATH = DATA_DIR / "historical_activist_campaigns.csv"


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
                        datefmt="%H:%M:%S")
    df = run_study(CSV_PATH)
    out_dir = DATA_DIR / "backtest"
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_dir / "activist_events.csv", index=False)

    md = ["# Activist 13D Coattails Study", ""]
    if df.empty:
        md += ["_No events completed._"]
    else:
        sm = summarize(df)
        md += ["## Aggregate returns by holding window", "",
               sm["aggregate"].round(4).to_markdown(index=False), ""]
        md += ["## By target size tier", "",
               sm["by_size_tier"].round(4).to_markdown(index=False), ""]
        cols = ["target", "filer", "ann_date", "size_tier",
                "target_12m", "excess_IWM_12m", "target_24m", "excess_IWM_24m"]
        avail = [c for c in cols if c in df.columns]
        md += ["## Per-event detail (12m / 24m)", "",
               df[avail].round(3).to_markdown(index=False), ""]

    path = out_dir / "activist_study.md"
    path.write_text("\n".join(md))
    logging.info("Wrote %s", path)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
