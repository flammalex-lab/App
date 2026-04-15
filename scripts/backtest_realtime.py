#!/usr/bin/env python3
"""Honest, no-look-ahead portfolio backtest.

Compares several selection rules. Crucially, all rules see only data
that was actually observable at filing time.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from alpha.backtest.realtime_simulator import (
    SimResult, simple_size_rule, simulate, threshold_rule,
)


def _summarize(name: str, r: SimResult, starting: float) -> dict:
    return {
        "rule": name,
        "starting": starting,
        "ending": round(r.final_capital, 0),
        "cagr": round(r.cagr, 3),
        "total_return": round(r.final_capital / starting - 1, 3),
        "n_taken": r.n_positions_taken,
        "n_closed": r.n_positions_closed,
        "win_rate": round(r.win_rate, 3),
        "biggest_winner": round(r.biggest_winner_pct, 3),
        "biggest_loser": round(r.biggest_loser_pct, 3),
        "rule_failed": r.rejection_reasons.get("rule_failed", 0),
        "portfolio_full": r.rejection_reasons.get("portfolio_full", 0),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_size.csv"))
    ap.add_argument("--starting", type=float, default=100_000)
    ap.add_argument("--out", type=Path,
                    default=Path("data/backtest/realtime_concentration.md"))
    args = ap.parse_args()

    df = pd.read_csv(args.csv)

    # Define rule comparisons
    rules = [
        ("nano + small only, max 5 concurrent",
         simple_size_rule(("nano (<$500M)", "small ($500M-$2B)")), 5, False),
        ("nano + small only, max 8 concurrent",
         simple_size_rule(("nano (<$500M)", "small ($500M-$2B)")), 8, False),
        ("nano + small only, max 10 concurrent",
         simple_size_rule(("nano (<$500M)", "small ($500M-$2B)")), 10, False),
        ("threshold quality>=0.70 (small + nano), max 5",
         threshold_rule(0.70), 5, False),
        ("threshold quality>=0.70, max 5, displace weakest",
         threshold_rule(0.70), 5, True),
        ("ALL events, max 10 concurrent",
         lambda ev: True, 10, False),
        ("ALL events, max 5 concurrent",
         lambda ev: True, 5, False),
    ]

    results = []
    for name, rule, max_n, displace in rules:
        r = simulate(
            df, selection_rule=rule, starting_capital=args.starting,
            max_concurrent_positions=max_n, displace_weakest=displace,
        )
        results.append(_summarize(name, r, args.starting))

    sm = pd.DataFrame(results)
    md = ["# Honest Walk-Forward Concentration Backtest", "",
          "**No look-ahead bias.** Events processed in chronological",
          "order. Each rule sees only data observable at filing time.",
          "Capital recycles as 18-month positions close.",
          "",
          "All numbers assume 50bps round-trip costs.",
          "",
          "## Comparison", "",
          sm.to_markdown(index=False),
          "",
          "## Honest comparison vs the earlier (biased) result",
          "",
          "Earlier 'top 5 per year by smallest mcap' showed +44.1% CAGR.",
          "That used year-end information to pick the 5 smallest of the",
          "year — small look-ahead bias.",
          "",
          "These rules use only filing-time data. The CAGR drop tells you",
          "how much the look-ahead bias inflated the previous result.",
          "",
          "## Notes",
          "- 'rule_failed' = events the rule rejected (not eligible)",
          "- 'portfolio_full' = events that qualified but the portfolio",
          "  was already at max concurrent positions",
          "- 'displace_weakest' = whether new high-quality events can",
          "  bump existing weaker positions",
          "- 'win_rate' is on closed positions only",
          ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(md))
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
