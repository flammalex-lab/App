#!/usr/bin/env python3
"""Re-run the chronological walk-forward with the heuristic filter applied.

Compares 4 scenarios:
  1. No filter (size only)
  2. Heuristic filter, accept buy + high_conviction
  3. Heuristic filter, high_conviction only (most strict)
  4. Heuristic filter, accept watch + buy + high_conviction (loosest)

For each, reports CAGR, win rate, biggest losers avoided.
"""
from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path

import pandas as pd

from alpha.backtest.heuristic_filter import HeuristicFilter
from alpha.backtest.realtime_simulator import simulate, simple_size_rule
from alpha.edgar import EdgarClient


def enrich_with_heuristic(events_df: pd.DataFrame, edgar: EdgarClient,
                           pause_s: float = 0.2) -> pd.DataFrame:
    """Add quality_score + recommendation columns using heuristic."""
    hf = HeuristicFilter(edgar)
    df = events_df.copy()
    scores: list[float] = []
    recs: list[str] = []
    flags_red: list[int] = []
    for _, row in df.iterrows():
        cik = str(row.get("cik") or "").zfill(10)
        if not cik or cik == "0000000000":
            scores.append(0.4); recs.append("watch"); flags_red.append(0)
            continue
        a = hf.assess(cik, filing_date=row.get("filed_date"))
        scores.append(a.quality_score)
        recs.append(a.pass_recommendation)
        flags_red.append(len(a.red_flags))
        time.sleep(pause_s)
    df["heuristic_score"] = scores
    df["heuristic_recommendation"] = recs
    df["heuristic_red_flag_count"] = flags_red
    return df


def make_filtered_rule(allowed_recs: tuple,
                        size_buckets=("nano (<$500M)", "small ($500M-$2B)")):
    def f(ev: pd.Series) -> bool:
        if ev.get("size_bucket") not in size_buckets:
            return False
        return ev.get("heuristic_recommendation") in allowed_recs
    return f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_size.csv"))
    ap.add_argument("--out", type=Path,
                    default=Path("data/backtest/realtime_with_heuristic.md"))
    ap.add_argument("--enriched-out", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_heuristic.csv"))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s: %(message)s")

    df = pd.read_csv(args.csv)

    if args.enriched_out.exists():
        logging.info("Reusing previously enriched CSV: %s", args.enriched_out)
        df = pd.read_csv(args.enriched_out)
    else:
        logging.info("Enriching %d events with heuristic filter (slow)...", len(df))
        edgar = EdgarClient()
        df = enrich_with_heuristic(df, edgar)
        df.to_csv(args.enriched_out, index=False)
        logging.info("Wrote %s", args.enriched_out)

    # Run the simulator with several rules
    rules = {
        "no filter (size only)":
            (simple_size_rule(), 5),
        "heuristic: high_conviction + buy":
            (make_filtered_rule(("high_conviction", "buy")), 5),
        "heuristic: high_conviction only (strict)":
            (make_filtered_rule(("high_conviction",)), 5),
        "heuristic: include watch (loose)":
            (make_filtered_rule(("high_conviction", "buy", "watch")), 5),
    }

    rows = []
    for label, (rule, max_n) in rules.items():
        r = simulate(df, selection_rule=rule, max_concurrent_positions=max_n,
                      starting_capital=100_000)
        win_rate = r.win_rate
        rows.append({
            "rule": label,
            "starting": 100_000,
            "ending": round(r.final_capital, 0),
            "cagr": round(r.cagr, 3),
            "n_taken": r.n_positions_taken,
            "win_rate": round(win_rate, 3),
            "biggest_loser": round(r.biggest_loser_pct, 3),
            "biggest_winner": round(r.biggest_winner_pct, 3),
            "rule_failed": r.rejection_reasons.get("rule_failed", 0),
            "portfolio_full": r.rejection_reasons.get("portfolio_full", 0),
        })

    sm = pd.DataFrame(rows)

    # Summary of heuristic filter coverage
    rec_counts = df["heuristic_recommendation"].value_counts() if "heuristic_recommendation" in df.columns else pd.Series()
    md = ["# Heuristic Filter Backtest", "",
          "Adds a quality filter (using free SEC XBRL Company Facts API)",
          "to the chronological walk-forward simulator. Compares hit rate",
          "and CAGR with and without filter.",
          "",
          "## Heuristic recommendation distribution", "",
          rec_counts.to_markdown() if not rec_counts.empty else "_no data_",
          "",
          "## Strategy comparison (max 5 concurrent, 18m hold)", "",
          sm.to_markdown(index=False),
          "",
          "## Interpretation",
          "",
          "If the heuristic filter increases CAGR vs 'no filter', the",
          "filter adds value by avoiding losers. If win_rate goes up but",
          "CAGR drops slightly, the filter is too aggressive (kicked out",
          "winners along with losers).",
          "",
          "The 'biggest_loser' column shows the worst single position the",
          "rule allowed in. Improvements in this column are pure",
          "drawdown-mitigation alpha.",
          ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(md))
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
