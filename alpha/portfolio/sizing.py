"""Position sizing using a (fractional) Kelly criterion.

Kelly fraction:
    f* = (b*p - q) / b
    where b = win/loss ratio, p = win probability, q = 1 - p

Pure Kelly is too aggressive in real life because:
- Edge estimates are noisy
- Returns are non-Gaussian (fat tails)
- Drawdowns at full Kelly are severe (Kelly maximizes log-wealth, not utility)

We use **quarter-Kelly to half-Kelly**, capped by a hard max position size,
and adjusted for portfolio concentration.

For a young, risk-tolerant investor, half-Kelly is reasonable on the
highest-conviction names; quarter-Kelly for everything else.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from alpha.portfolio.conviction import ConvictionLevel, ConvictionScore


@dataclass
class SizeRecommendation:
    pct_of_portfolio: float          # 0.0 - 1.0
    dollar_amount: float | None      # if portfolio_value provided
    kelly_fraction: float            # the unscaled Kelly result
    kelly_multiplier: float          # what fraction of full Kelly we used
    rationale: str


def kelly_size(p_win: float, mean_win: float, mean_loss: float) -> float:
    """
    Compute full-Kelly fraction.

    Args:
        p_win: probability of a winning outcome (0-1)
        mean_win: mean return on a winning bet (e.g., +0.50 = +50%)
        mean_loss: mean LOSS on a losing bet, expressed as a positive
            number (e.g., 0.20 = -20% loss)
    """
    if mean_loss <= 0:
        return 0.0
    b = mean_win / mean_loss
    q = 1.0 - p_win
    f = (b * p_win - q) / b
    return max(0.0, f)


# Conservative defaults for "what's the typical loss when I'm wrong"
# in each conviction tier. These are calibrated from the walk-forward
# distribution: even on small/nano spins, ~25-30% of positions lost
# 20-50%; ~5-10% lost >50%.
TYPICAL_LOSS_BY_LEVEL = {
    ConvictionLevel.PASS:            0.25,
    ConvictionLevel.WATCH:           0.25,
    ConvictionLevel.STARTER:         0.30,
    ConvictionLevel.CORE:            0.30,
    ConvictionLevel.HIGH_CONVICTION: 0.30,
}

KELLY_MULTIPLIER_BY_LEVEL = {
    ConvictionLevel.PASS:            0.0,
    ConvictionLevel.WATCH:           0.0,    # do not size
    ConvictionLevel.STARTER:         0.25,   # quarter-Kelly
    ConvictionLevel.CORE:            0.40,
    ConvictionLevel.HIGH_CONVICTION: 0.50,   # half-Kelly
}

# Hard caps to prevent any single name from blowing up the portfolio
HARD_CAP_BY_LEVEL = {
    ConvictionLevel.PASS:            0.00,
    ConvictionLevel.WATCH:           0.00,
    ConvictionLevel.STARTER:         0.03,    # 3%
    ConvictionLevel.CORE:            0.07,    # 7%
    ConvictionLevel.HIGH_CONVICTION: 0.10,    # 10%
}


def recommend_size(
    conviction: ConvictionScore,
    portfolio_value: Optional[float] = None,
    risk_aggression: float = 1.0,    # 1.0 = default, 1.5 = more aggressive
) -> SizeRecommendation:
    """
    Translate a conviction score into a position size recommendation.

    `risk_aggression` lets the caller scale all sizes for a more
    aggressive (or more conservative) overall stance. >1.0 deploys
    closer to full Kelly; <1.0 stays well below.
    """
    typical_loss = TYPICAL_LOSS_BY_LEVEL[conviction.level]
    full_kelly = kelly_size(
        p_win=conviction.win_probability,
        mean_win=conviction.expected_edge / max(0.01, conviction.win_probability),
        mean_loss=typical_loss,
    )
    base_mult = KELLY_MULTIPLIER_BY_LEVEL[conviction.level]
    mult = min(0.75, base_mult * risk_aggression)   # never exceed 3/4 Kelly
    raw = full_kelly * mult
    pct = min(HARD_CAP_BY_LEVEL[conviction.level], raw)

    rationale = (
        f"Kelly={full_kelly:.2%} × {mult:.2f}x ({conviction.level.name}) "
        f"= {raw:.2%}; capped at {HARD_CAP_BY_LEVEL[conviction.level]:.0%}. "
        f"Edge={conviction.expected_edge:.2%}, "
        f"P(win)={conviction.win_probability:.2%}, "
        f"typical_loss={typical_loss:.0%}."
    )

    return SizeRecommendation(
        pct_of_portfolio=pct,
        dollar_amount=(pct * portfolio_value) if portfolio_value else None,
        kelly_fraction=full_kelly,
        kelly_multiplier=mult,
        rationale=rationale,
    )
