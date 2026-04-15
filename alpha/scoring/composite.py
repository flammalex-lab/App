"""Composite ranking.

Strategy:
    score = sum over signals on this ticker of
            weight(signal_type) * confidence * tanh(asymmetry / 3)

The tanh squashes extreme asymmetry claims so a single hit can't dominate.
Multi-signal stacking is rewarded: an activist 13D + insider cluster +
capital-allocator regime change on the same name is worth far more than
three independent medium-confidence signals on three different names.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from typing import Any

from alpha.store import Store


SIGNAL_WEIGHT = {
    "spinoff":                   1.5,
    "activist_13d":              1.4,
    "insider_cluster":           1.2,
    "post_bankruptcy":           1.3,
    "capital_allocator_regime":  1.3,
    "index_migration":           0.9,
    "supply_chain_cascade":      0.7,
    "hedging_language":          0.6,
    "ghost_ship":                1.0,
}


def rank_signals(store: Store, days: int = 14) -> list[dict[str, Any]]:
    hits = store.signals_since(days=days)
    by_key: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"score": 0.0, "signals": [], "metadata": {}}
    )

    for h in hits:
        key = (h["ticker"] or "", h["cik"] or "")
        w = SIGNAL_WEIGHT.get(h["signal_type"], 1.0)
        asym = float(h["asymmetry"] or 0.0)
        conf = float(h["confidence"] or 0.0)
        # Negative asymmetry = short / avoid — penalize score
        contribution = w * conf * math.tanh(asym / 3.0)
        by_key[key]["score"] += contribution
        by_key[key]["signals"].append({
            "type": h["signal_type"],
            "headline": h["headline"],
            "rationale": h["rationale"],
            "confidence": conf,
            "asymmetry": asym,
            "detected_at": h["detected_at"],
        })

    # Multi-signal stacking bonus
    for v in by_key.values():
        distinct = len({s["type"] for s in v["signals"]})
        if distinct >= 2:
            v["score"] *= 1 + 0.15 * (distinct - 1)

    ranked = sorted(
        (
            {
                "ticker": k[0] or None,
                "cik": k[1] or None,
                "composite_score": round(v["score"], 3),
                "signal_count": len(v["signals"]),
                "distinct_types": len({s["type"] for s in v["signals"]}),
                "signals": v["signals"],
                "rationale": _top_rationale(v["signals"]),
            }
            for k, v in by_key.items()
        ),
        key=lambda r: r["composite_score"],
        reverse=True,
    )
    return ranked


def _top_rationale(signals: list[dict[str, Any]]) -> str:
    sigs = sorted(signals,
                  key=lambda s: s["confidence"] * abs(s["asymmetry"]),
                  reverse=True)[:3]
    return " | ".join(f"[{s['type']}] {s['headline']}" for s in sigs)
