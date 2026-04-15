"""ConvictionScorer.

Aggregates all signals on a single name into a conviction level (0-1)
and an "expected edge" (probability of positive return × magnitude).

This is the bridge between the wide-net detection layer and the
narrow concentrated execution layer. The wider system flags 50-100
candidates per quarter; the conviction scorer says which 5-10 deserve
real capital.

Edge calibration is anchored to the walk-forward backtest:
  - small/nano spin-off: ~+50% mean at 18m, 60% hit rate
  - large-cap activist: ~+30% at 18m, 65% hit
  - small-cap activist: ~0% (until regime change)
  - other signals: documented in literature, not yet validated locally

Multi-signal stacking is applied multiplicatively — a name with three
independent signals gets a meaningful boost (capped at 0.95).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import Any


class ConvictionLevel(IntEnum):
    PASS = 0          # below threshold; do not deploy capital
    WATCH = 1         # interesting but not a buy
    STARTER = 2       # 1-2% position
    CORE = 3          # 5-7% position
    HIGH_CONVICTION = 4  # 8-10% position; consider LEAPS overlay


@dataclass
class ConvictionScore:
    level: ConvictionLevel
    score: float                  # 0.0 - 1.0
    expected_edge: float          # E[return at 18m]
    win_probability: float        # P(return > 0 at 18m)
    rationale: str
    signals_used: list[str]


# Per-signal calibrated edge profile from walk-forward + literature
# (mean_return_18m, win_probability_18m, confidence_floor)
EDGE_PROFILE: dict[str, tuple[float, float, float]] = {
    # Validated locally (walk-forward 2015-2024)
    "spinoff_nano":       (0.69, 0.67, 0.55),  # nano newcos
    "spinoff_small":      (0.56, 0.57, 0.50),  # $500M-$2B
    "spinoff_mid":        (0.16, 0.55, 0.30),  # $2B-$10B (the trap)
    "spinoff_large":      (0.48, 0.82, 0.45),  # >$10B
    "activist_large":     (0.32, 0.65, 0.40),  # validated for large-cap
    "activist_small":     (0.05, 0.50, 0.20),  # currently underperforming
    # Literature-grounded but unvalidated locally
    "insider_cluster":    (0.18, 0.60, 0.40),  # Cohen-Malloy-Pomorski
    "post_bankruptcy":    (0.45, 0.55, 0.45),  # post-emergence equity
    "capital_allocator":  (0.30, 0.62, 0.40),
    "supply_chain":       (0.10, 0.55, 0.30),
    "index_migration":    (0.06, 0.70, 0.40),  # short-window event
    "ghost_ship":         (0.40, 0.45, 0.35),  # very binary
    "negative_ev":        (0.35, 0.55, 0.40),
}


def _signal_edge_key(signal_type: str, metadata: dict[str, Any]) -> str:
    """Map raw signal to specific edge profile (e.g. small vs large spin)."""
    if signal_type == "spinoff":
        label = metadata.get("size_label", "")
        if label in ("nano", "small", "mid", "large"):
            return f"spinoff_{label}"
        return "spinoff_small"  # default to sweet spot
    if signal_type == "activist_13d":
        tier = metadata.get("target_size_tier") or metadata.get("size_tier", "")
        if tier in ("micro", "small", "micro-to-small"):
            return "activist_small"
        return "activist_large"
    if signal_type == "capital_allocator_regime":
        return "capital_allocator"
    if signal_type == "supply_chain_cascade":
        return "supply_chain"
    return signal_type


def score_conviction(signals_on_name: list[dict[str, Any]]) -> ConvictionScore:
    """
    Args:
        signals_on_name: list of signal dicts (the same shape as signals
            returned by Store.signals_since), all referring to the same
            ticker/CIK.

    Returns:
        ConvictionScore with level, expected edge, win probability.
    """
    if not signals_on_name:
        return ConvictionScore(
            level=ConvictionLevel.PASS, score=0.0, expected_edge=0.0,
            win_probability=0.5, rationale="no signals", signals_used=[],
        )

    # Normalize metadata once (handle JSON string form from DB)
    import json
    norm: list[tuple[str, dict]] = []
    for s in signals_on_name:
        meta = s.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:  # noqa: BLE001
                meta = {}
        norm.append((s.get("signal_type", ""), meta))

    # Combine each signal's edge weighted by its confidence
    weighted_edge = 0.0
    weighted_win = 0.0
    weight_sum = 0.0
    used = []
    for (st, meta), s in zip(norm, signals_on_name):
        key = _signal_edge_key(st, meta)
        profile = EDGE_PROFILE.get(key)
        if profile is None:
            continue
        edge, p_win, conf_floor = profile
        conf = max(conf_floor, float(s.get("confidence", 0.5)))
        weighted_edge += edge * conf
        weighted_win  += p_win * conf
        weight_sum += conf
        used.append(key)

    if weight_sum == 0:
        return ConvictionScore(
            level=ConvictionLevel.PASS, score=0.0, expected_edge=0.0,
            win_probability=0.5,
            rationale="no scorable signals",
            signals_used=[s.get("signal_type", "") for s in signals_on_name],
        )

    base_edge = weighted_edge / weight_sum
    base_win = weighted_win / weight_sum

    # Stacking bonus: distinct signal types on the same name compound
    distinct = len({_signal_edge_key(st, meta) for st, meta in norm})
    stacking_mult = 1.0 + 0.20 * (distinct - 1)
    edge = min(2.0, base_edge * stacking_mult)
    win = min(0.95, base_win + 0.05 * (distinct - 1))

    # Composite score: edge * win prob, normalized so the best realistic
    # single-signal hit is ~0.5 and stacked top conviction reaches ~0.9
    score = min(1.0, edge * win)

    if score >= 0.55:
        level = ConvictionLevel.HIGH_CONVICTION
    elif score >= 0.40:
        level = ConvictionLevel.CORE
    elif score >= 0.25:
        level = ConvictionLevel.STARTER
    elif score >= 0.10:
        level = ConvictionLevel.WATCH
    else:
        level = ConvictionLevel.PASS

    rat = (
        f"Edge={edge:.2f}, P(win)={win:.2%}, distinct_signals={distinct}, "
        f"signals=[{', '.join(used)}]"
    )
    return ConvictionScore(
        level=level, score=score, expected_edge=edge,
        win_probability=win, rationale=rat, signals_used=used,
    )
