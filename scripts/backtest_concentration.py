#!/usr/bin/env python3
"""Test: does concentration (top-N per year) outperform diversification?

Loads the size-enriched walk-forward CSV and simulates several
selection strategies, computing portfolio CAGR and total return for each.

Strategies tested:
- All flagged (no filter)
- All small + nano
- Top 8 per year by smallest newco mcap
- Top 5 per year by smallest newco mcap
- Top 3 per year by smallest newco mcap
- Top 5 per year by smallest, with $X portfolio simulation
  (equal-weight, hold 18m, recycle capital into next year's picks)
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def filter_topn_per_year(df: pd.DataFrame, n: int,
                          rank_col: str = "newco_start_mcap",
                          ascending: bool = True) -> pd.DataFrame:
    """Keep top-N events per cohort year, ranked by `rank_col`."""
    df = df.copy()
    df["year"] = pd.to_datetime(df["filed_date"]).dt.year
    if ascending:
        df = df.sort_values(rank_col, ascending=True)
    else:
        df = df.sort_values(rank_col, ascending=False)
    return df.groupby("year").head(n)


def portfolio_metrics(df: pd.DataFrame, hold_window: str = "ret_18m",
                       cost_bps: float = 50,
                       hold_months: int = 18) -> dict:
    """Compute portfolio-level metrics under equal-weight + recycle."""
    rets = df[hold_window].dropna() - cost_bps / 10_000
    if rets.empty:
        return {}
    n = len(rets)
    # If we hold each name for hold_months and rebalance per cohort year,
    # approximate annualized return as (1 + mean_per_position)^(12/hold_months)
    mean_pos = rets.mean()
    cagr = (1 + mean_pos) ** (12 / hold_months) - 1
    return {
        "n_positions": n,
        "mean_per_position": mean_pos,
        "median_per_position": rets.median(),
        "hit_rate": float((rets > 0).mean()),
        "implied_cagr": cagr,
        "p25": rets.quantile(0.25),
        "p75": rets.quantile(0.75),
        "best": rets.max(),
        "worst": rets.min(),
    }


def equity_curve_simulation(df: pd.DataFrame, n_per_year: int = 5,
                             hold_months: int = 18,
                             starting_capital: float = 100_000,
                             cost_bps: float = 50) -> pd.DataFrame:
    """
    Simulate a more realistic portfolio:
    - Each year, take top-N picks (smallest mcap)
    - Equal-weight allocation among that year's N positions
    - Hold 18 months
    - Recycle capital (capital from year T's positions becomes available
      for year T+18m positions, reinvested fully)

    This is a simplified annual-cohort model; the real implementation
    would track per-position calendar.
    """
    df = df.copy()
    df["year"] = pd.to_datetime(df["filed_date"]).dt.year
    df = df.dropna(subset=["ret_18m", "newco_start_mcap"])
    df = df.sort_values("newco_start_mcap")

    rows = []
    capital = starting_capital
    years = sorted(df["year"].unique())
    for year in years:
        cohort = df[df["year"] == year].head(n_per_year)
        if cohort.empty:
            continue
        # Equal-weight, apply 18m return minus costs
        cohort_rets = cohort["ret_18m"] - cost_bps / 10_000
        cohort_mean = cohort_rets.mean()
        starting = capital
        capital = capital * (1 + cohort_mean)
        rows.append({
            "year": year,
            "n_positions": len(cohort),
            "starting_capital": starting,
            "ending_capital": capital,
            "cohort_return": cohort_mean,
        })
    eq = pd.DataFrame(rows)
    if not eq.empty:
        years_span = eq["year"].max() - eq["year"].min() + 1
        eq.attrs["cagr"] = (capital / starting_capital) ** (1 / years_span) - 1
        eq.attrs["total_return"] = capital / starting_capital - 1
        eq.attrs["years_span"] = years_span
    return eq


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_size.csv"))
    ap.add_argument("--out", type=Path,
                    default=Path("data/backtest/concentration_study.md"))
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    df_sized = df.dropna(subset=["newco_start_mcap"])

    # Strategy 1: All flagged events
    s1 = portfolio_metrics(df.dropna(subset=["ret_18m"]))

    # Strategy 2: small + nano only
    small_nano = df_sized[df_sized["size_bucket"].isin(
        ["nano (<$500M)", "small ($500M-$2B)"])]
    s2 = portfolio_metrics(small_nano)

    # Strategies 3-5: top-N per year by smallest mcap
    strategies = {}
    for n in [10, 8, 5, 3]:
        topn = filter_topn_per_year(df_sized, n)
        strategies[f"top_{n}_per_year"] = portfolio_metrics(topn)

    # Equity simulations
    sims = {}
    for n in [10, 5, 3]:
        eq = equity_curve_simulation(df_sized, n_per_year=n)
        sims[f"sim_top_{n}_per_year"] = eq

    # Build report
    L = ["# Concentration Backtest", "",
         "Tests whether concentrating to top-N picks per year (by smallest",
         "newco market cap) outperforms wider deployment, on the 2015-2024",
         "walk-forward dataset (n=197 raw, ~119 with size data).", "",
         "All numbers assume 50bps round-trip costs, 18-month hold, no leverage.",
         ""]

    L += ["## Per-position summary (mean return per pick)", ""]
    summary = pd.DataFrame([
        {"strategy": "All flagged events",        **s1},
        {"strategy": "Small + nano only",         **s2},
        *[{"strategy": k, **v} for k, v in strategies.items()],
    ])
    L.append(summary.round(3).to_markdown(index=False))

    L += ["", "## Equity curve simulations (recycled capital)", ""]
    for label, sim in sims.items():
        if sim.empty:
            L.append(f"### {label}\n_no data_\n")
            continue
        years_span = sim.attrs.get("years_span", 0)
        cagr = sim.attrs.get("cagr", 0)
        tr = sim.attrs.get("total_return", 0)
        L += [
            f"### {label}",
            f"- Years: {years_span}",
            f"- Total return: **{tr:.1%}**",
            f"- CAGR: **{cagr:.1%}**",
            "",
            sim.round(3).to_markdown(index=False),
            "",
        ]

    L += ["## Interpretation", "",
          "If top-N concentration shows higher per-position mean and",
          "higher CAGR than 'small + nano only', concentration adds",
          "value beyond just the size filter. If not, the size filter",
          "captures all the alpha and you should diversify within it.",
          "",
          "**With Kelly sizing layered on**, you'd hold each year's",
          "5-8 picks at 5-10% each (40-50% of portfolio), keep the rest",
          "in T-bills + LEAPS overlays + special situations. Realistic",
          "portfolio CAGR depends on the per-position mean and how aggressively",
          "you Kelly-size."]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(L))
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
