#!/usr/bin/env python3
"""Quick sanity check: compare LLM calls vs actual forward returns."""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_llm.csv"))
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    df = df[df["llm_scored"] == True].copy() if "llm_scored" in df.columns else df

    if df.empty:
        print("No LLM-scored events yet. Run scripts/llm_backfill.py first.")
        return 1

    # Show each LLM call alongside actual returns
    cols = [
        "filed_date", "ticker", "company", "size_bucket",
        "llm_recommendation", "llm_quality_score",
        "ret_3m", "ret_6m", "ret_12m", "ret_18m",
    ]
    available = [c for c in cols if c in df.columns]
    show = df[available].copy()
    # Pretty-format returns as percent
    for c in ("ret_3m", "ret_6m", "ret_12m", "ret_18m"):
        if c in show.columns:
            show[c] = show[c].apply(
                lambda x: f"{x*100:+6.1f}%" if pd.notna(x) else "    —"
            )
    if "llm_quality_score" in show.columns:
        show["llm_quality_score"] = show["llm_quality_score"].apply(
            lambda x: f"{x:.2f}" if pd.notna(x) else "—"
        )

    print(f"\n=== LLM calls vs actual returns ({len(show)} events) ===\n")
    print(show.to_string(index=False))

    # Aggregate: does LLM recommendation correlate with returns?
    print("\n=== Aggregate: mean return by LLM recommendation ===\n")
    for horizon in ("ret_3m", "ret_6m", "ret_12m", "ret_18m"):
        if horizon not in df.columns:
            continue
        g = df.groupby("llm_recommendation")[horizon].agg(
            ["count", "mean", "median"]
        ).round(3)
        if g.empty:
            continue
        g["mean"] = g["mean"].apply(lambda x: f"{x*100:+.1f}%"
                                      if pd.notna(x) else "—")
        g["median"] = g["median"].apply(lambda x: f"{x*100:+.1f}%"
                                          if pd.notna(x) else "—")
        print(f"Horizon {horizon}:")
        print(g.to_string())
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
