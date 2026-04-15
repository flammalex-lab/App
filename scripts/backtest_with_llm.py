#!/usr/bin/env python3
"""Re-run the chronological walk-forward with the LLM filter applied.

Prereq: run scripts/llm_backfill.py first to populate LLM scores.

Compares multiple policies:
  - No filter (baseline)
  - Heuristic filter only (pre-LLM calibrated)
  - LLM filter: high_conviction + buy
  - LLM filter: high_conviction only
  - LLM filter ANDed with heuristic (both must approve)
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from alpha.backtest.realtime_simulator import simulate


def rule_factory(size_ok: tuple, llm_ok: tuple | None = None,
                 heuristic_ok: tuple | None = None):
    def f(ev: pd.Series) -> bool:
        if ev.get("size_bucket") not in size_ok:
            return False
        if llm_ok is not None:
            if ev.get("llm_recommendation") not in llm_ok:
                return False
        if heuristic_ok is not None:
            if ev.get("heuristic_recommendation") not in heuristic_ok:
                return False
        return True
    return f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path(
                        "data/backtest/walk_forward_2015-01-01_2024-12-31/"
                        "spinoff_events_with_llm.csv"))
    ap.add_argument("--out", type=Path,
                    default=Path("data/backtest/realtime_with_llm.md"))
    args = ap.parse_args()

    if not args.csv.exists():
        raise SystemExit(
            f"{args.csv} not found. Run scripts/llm_backfill.py first.")

    df = pd.read_csv(args.csv)

    # Merge in heuristic columns if available
    heur_csv = args.csv.with_name(
        args.csv.stem.replace("_with_llm", "_with_heuristic") + ".csv"
    )
    if heur_csv.exists() and "heuristic_recommendation" not in df.columns:
        heur = pd.read_csv(heur_csv)
        heur_cols = ["cik", "filed_date", "heuristic_recommendation",
                      "heuristic_score", "heuristic_red_flag_count"]
        available = [c for c in heur_cols if c in heur.columns]
        df = df.merge(heur[available], on=["cik", "filed_date"], how="left")

    sizes = ("nano (<$500M)", "small ($500M-$2B)")
    has_heuristic = "heuristic_recommendation" in df.columns
    has_llm = "llm_recommendation" in df.columns and df["llm_recommendation"].notna().any()

    n_llm = int(df["llm_scored"].sum()) if "llm_scored" in df.columns else 0

    rules = [
        ("No filter (baseline)", rule_factory(sizes), 5),
    ]
    if has_heuristic:
        rules.append(("Heuristic only (buy or high_conviction)",
                       rule_factory(sizes, heuristic_ok=("buy", "high_conviction")),
                       5))
    if has_llm:
        rules += [
            ("LLM: high_conviction + buy",
             rule_factory(sizes, llm_ok=("high_conviction", "buy")), 5),
            ("LLM: high_conviction only",
             rule_factory(sizes, llm_ok=("high_conviction",)), 5),
        ]
        if has_heuristic:
            rules.append((
                "LLM AND heuristic (both approve)",
                rule_factory(sizes,
                              llm_ok=("high_conviction", "buy"),
                              heuristic_ok=("buy", "high_conviction")), 5))

    rows = []
    for label, rule, max_n in rules:
        r = simulate(df, selection_rule=rule, max_concurrent_positions=max_n,
                      starting_capital=100_000)
        rows.append({
            "rule": label,
            "ending": round(r.final_capital, 0),
            "cagr": round(r.cagr, 3),
            "n_taken": r.n_positions_taken,
            "win_rate": round(r.win_rate, 3),
            "biggest_loser": round(r.biggest_loser_pct, 3),
            "biggest_winner": round(r.biggest_winner_pct, 3),
            "rule_failed": r.rejection_reasons.get("rule_failed", 0),
            "portfolio_full": r.rejection_reasons.get("portfolio_full", 0),
        })
    sm = pd.DataFrame(rows)

    # Recommendation distribution
    dist_rows = []
    if has_llm:
        dist_rows.append(("LLM",
                           df["llm_recommendation"].value_counts().to_dict()))
    if has_heuristic:
        dist_rows.append(("Heuristic",
                           df["heuristic_recommendation"].value_counts().to_dict()))

    md = [
        "# LLM-Filtered Walk-Forward Backtest", "",
        f"Events: {len(df)} total, {n_llm} LLM-scored.", "",
        "## Strategy comparison (max 5 concurrent, 18m hold, 50bps costs)", "",
        sm.to_markdown(index=False), "",
    ]
    if dist_rows:
        md += ["## Filter output distributions", ""]
        for label, counts in dist_rows:
            md += [f"### {label}", ""]
            for k, v in counts.items():
                md.append(f"- `{k}`: {v}")
            md.append("")
    md += [
        "## Interpretation", "",
        "- If LLM-filtered CAGR > baseline, the LLM added alpha by",
        "  identifying losers the heuristic couldn't.",
        "- Watch `n_taken`: aggressive filtering drops it; if too low,",
        "  the portfolio won't compound even if per-position returns",
        "  are high.",
        "- `biggest_loser` improvements are drawdown-mitigation alpha.",
        "- 'LLM AND heuristic' is the strictest; it's the honest",
        "  stack the production system uses.",
    ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(md))
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
