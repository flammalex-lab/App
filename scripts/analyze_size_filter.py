#!/usr/bin/env python3
"""Enrich a walk-forward CSV with newco size and analyze by bucket."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd

from alpha.backtest.size_filter import enrich_with_size, summarize_by_size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s: %(message)s",
                        datefmt="%H:%M:%S")

    df = pd.read_csv(args.csv)
    logging.info("Enriching %d events with newco_start_mcap...", len(df))
    enriched = enrich_with_size(df)

    out_csv = args.out or args.csv.parent / (args.csv.stem + "_with_size.csv")
    enriched.to_csv(out_csv, index=False)
    logging.info("Wrote %s", out_csv)

    summary = summarize_by_size(enriched)
    summary_path = args.csv.parent / (args.csv.stem + "_size_summary.md")
    md = ["# Spin-off returns by newco size at entry", "",
          "Greenblatt thesis: small spins outperform.",
          "Bucketed by newco market cap on first trading day.",
          "", summary.round(4).to_markdown(index=False)]
    summary_path.write_text("\n".join(md))
    logging.info("Wrote %s", summary_path)
    print(summary_path)

    # Also emit the per-bucket counts so we can see distribution
    print("\nDistribution:")
    print(enriched["size_bucket"].value_counts())
    return 0


if __name__ == "__main__":
    sys.exit(main())
