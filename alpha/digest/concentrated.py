"""Concentrated digest: top-N highest-conviction names with sizing.

This is the digest mode for an aggressive operator who wants 5-10
high-conviction positions, not 25 diversified watchlist names.
For each top-N pick, it produces:
  - Conviction score + level
  - Recommended Kelly-sized position
  - LEAPS overlay recommendation (if CORE+ conviction)
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from alpha.config import DATA_DIR
from alpha.portfolio import (
    ConvictionLevel, recommend_leap, recommend_size, score_conviction,
)
from alpha.store import Store


def build_concentrated_digest(
    store: Store,
    top_n: int = 8,
    portfolio_value: float | None = None,
    risk_aggression: float = 1.0,
    days: int = 30,
) -> str:
    """Generate a concentrated, conviction-ranked digest."""
    raw = store.signals_since(days=days)

    # Group signals by ticker (or CIK as fallback)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in raw:
        key = s["ticker"] or s["cik"] or "?"
        grouped[key].append({
            "signal_type": s["signal_type"],
            "headline": s["headline"],
            "rationale": s["rationale"],
            "confidence": s["confidence"] or 0.5,
            "asymmetry": s["asymmetry"] or 1.0,
            "metadata": s["metadata_json"] or "{}",
        })

    # Score each name
    scored = []
    for name, sigs in grouped.items():
        cs = score_conviction(sigs)
        if cs.level == ConvictionLevel.PASS:
            continue
        sr = recommend_size(cs, portfolio_value=portfolio_value,
                             risk_aggression=risk_aggression)
        leap = recommend_leap(name, cs, sr) if cs.level >= ConvictionLevel.CORE else None
        scored.append({
            "name": name,
            "conviction": cs,
            "size": sr,
            "leap": leap,
            "signal_count": len(sigs),
            "signals": sigs,
        })

    scored.sort(key=lambda r: r["conviction"].score, reverse=True)
    picks = scored[:top_n]

    L: list[str] = [
        f"# Concentrated Conviction Digest — {date.today()}",
        "",
        f"Top {len(picks)} high-conviction names. Sized via "
        f"fractional Kelly (risk_aggression={risk_aggression}). "
        f"Portfolio value: ${portfolio_value:,.0f}." if portfolio_value
        else "Top {} high-conviction names. Sized as % of portfolio "
             "(set ALPHA_PORTFOLIO_VALUE for $ amounts).".format(len(picks)),
        "",
    ]

    if not picks:
        L += ["_No qualifying names. Either no signals in window, or "
              "none cleared the conviction threshold._"]
        return "\n".join(L)

    # Summary table
    L += [
        "## Picks (sorted by conviction)",
        "",
        "| Rank | Name | Level | Score | Edge | P(win) | Size % | $ Size | LEAPS % |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    total_equity = 0.0
    total_leaps = 0.0
    for i, p in enumerate(picks, 1):
        cs = p["conviction"]; sr = p["size"]; leap = p["leap"]
        eq_dollar = sr.dollar_amount or 0
        leap_pct = leap.sizing_pct_of_portfolio if leap else 0
        total_equity += sr.pct_of_portfolio
        total_leaps += leap_pct
        L.append(
            f"| {i} | `{p['name']}` | {cs.level.name} | {cs.score:.2f} | "
            f"{cs.expected_edge:.0%} | {cs.win_probability:.0%} | "
            f"{sr.pct_of_portfolio:.1%} | "
            f"{('$%s' % f'{eq_dollar:,.0f}') if portfolio_value else '-'} | "
            f"{leap_pct:.1%} |"
        )
    L += ["",
          f"**Total equity allocation: {total_equity:.1%}**  ",
          f"**Total LEAPS allocation: {total_leaps:.1%}**  ",
          f"**Cash / unallocated: {max(0, 1 - total_equity - total_leaps):.1%}**",
          ""]

    # Detail per pick
    L += ["## Per-pick detail", ""]
    for i, p in enumerate(picks, 1):
        cs = p["conviction"]; sr = p["size"]; leap = p["leap"]
        L += [
            f"### {i}. `{p['name']}` — {cs.level.name} (score {cs.score:.2f})",
            "",
            f"**Signals on this name** ({p['signal_count']}):"]
        for s in p["signals"][:5]:
            L.append(f"- _[{s['signal_type']}]_ {s['headline']}")
        L += [
            "",
            f"**Conviction**: {cs.rationale}",
            "",
            f"**Position sizing**: {sr.rationale}",
            "",
        ]
        if leap:
            L += [
                f"**LEAPS overlay**: target strike +{leap.strike_pct_otm:.0%} OTM, "
                f"~{leap.expiry_months_target}-month expiry. "
                f"Suggested allocation: {leap.sizing_pct_of_portfolio:.1%} of portfolio.",
                f"_{leap.rationale}_",
                "",
            ]

    L += [
        "---",
        "## Discipline checklist",
        "",
        "- [ ] Each pick has a written pre-mortem ('if this goes to zero, why?').",
        "- [ ] Portfolio cash floor: ≥10% in T-bills.",
        "- [ ] No single position > hard cap (10% equity, 3% LEAPS).",
        "- [ ] Drawdown circuit breaker: -30% portfolio = 2-week deployment freeze.",
        "- [ ] Kelly multiplier set conservatively. Increase only after 12 months of",
        "      live performance vs expectation.",
        "- [ ] LEAPS only when IV ≤ 50% of 1y range. Don't pay for someone's fear.",
    ]
    return "\n".join(L)


def write_concentrated_digest(
    store: Store,
    top_n: int = 8,
    portfolio_value: float | None = None,
    risk_aggression: float = 1.0,
) -> Path:
    out_dir = DATA_DIR / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"concentrated-{date.today().isoformat()}.md"
    md = build_concentrated_digest(store, top_n=top_n,
                                     portfolio_value=portfolio_value,
                                     risk_aggression=risk_aggression)
    path.write_text(md)
    return path
