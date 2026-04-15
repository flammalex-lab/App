"""LEAPS (long-dated options) recommender.

For high-conviction names, LEAPS give 2-4x leverage on the upside with
capped downside (lose at most the premium). They're the right tool for
asymmetric bets where you have a 12-24 month thesis and willing to
accept binary outcomes.

Heuristics (not Black-Scholes; the goal is decision support, not
mispricing identification):

1. **Strike**: ATM to slightly OTM (5-15% OTM) for highest expected
   leverage on a thesis. Deep ITM gives less leverage; deep OTM
   sacrifices too much delta.
2. **Expiry**: 18-24 months minimum so theta decay is manageable. The
   farthest available LEAPS (Jan/Jun expiries 2 years out).
3. **Implied volatility**: only buy when IV is in the bottom half of
   its 1-year range. High-IV LEAPS are paying for someone else's fear.
4. **Position sizing**: the Kelly result on the underlying, divided by
   the leverage of the LEAPS position. So if Kelly says 8% in equity,
   and the LEAPS gives ~3x leverage, size the LEAPS at ~3% of portfolio.

Output: a recommendation document the user can take to their broker.
This module does NOT execute trades.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from alpha.portfolio.conviction import ConvictionScore
from alpha.portfolio.sizing import SizeRecommendation


@dataclass
class LeapRecommendation:
    underlying_ticker: str
    strike_pct_otm: float          # e.g., 0.10 = 10% OTM
    expiry_months_min: int         # e.g., 18
    expiry_months_target: int      # e.g., 24
    leverage_estimate: float       # rough delta-based leverage
    sizing_pct_of_portfolio: float
    breakeven_underlying_move: float  # how much the stock needs to move
    rationale: str


def _approx_delta_otm(pct_otm: float, t_years: float, iv: float) -> float:
    """
    Crude Black-Scholes delta approximation for a slightly-OTM call.
    We use it just for leverage estimation, not pricing.
    """
    # d1 ≈ (-ln(1+pct_otm) + (iv^2 / 2) * t) / (iv * sqrt(t))
    d1 = (-math.log(1 + pct_otm) + (iv ** 2) * t_years / 2) / (iv * math.sqrt(t_years))
    # N(d1)
    from math import erf
    return 0.5 * (1 + erf(d1 / math.sqrt(2)))


def _approx_premium_pct_of_strike(pct_otm: float, t_years: float,
                                    iv: float) -> float:
    """Crude premium estimate as a fraction of strike."""
    # Time value approx: 0.4 * iv * sqrt(t)
    time_value = 0.4 * iv * math.sqrt(t_years)
    intrinsic = max(0, -pct_otm)
    return intrinsic + time_value


def recommend_leap(
    underlying_ticker: str,
    conviction: ConvictionScore,
    equity_size: SizeRecommendation,
    assumed_iv: float = 0.40,
    target_strike_otm: float = 0.10,
    target_expiry_months: int = 24,
) -> Optional[LeapRecommendation]:
    """
    Returns a LEAPS recommendation for high-conviction names; None otherwise.

    The LEAPS sleeve should only carry positions where:
    - You'd already be willing to size the equity
    - The thesis horizon is 12-24 months (matches LEAPS expiry)
    - You're willing to accept binary outcomes
    """
    from alpha.portfolio.conviction import ConvictionLevel
    if conviction.level < ConvictionLevel.CORE:
        return None

    t_years = target_expiry_months / 12
    delta = _approx_delta_otm(target_strike_otm, t_years, assumed_iv)
    premium_pct = _approx_premium_pct_of_strike(target_strike_otm, t_years,
                                                  assumed_iv)
    # Leverage = delta / (premium / 1) in approx terms
    # If premium is 25% of strike, you control the strike for 25% — leverage ~4x
    if premium_pct <= 0:
        return None
    leverage = delta / premium_pct

    # Size the LEAPS so its capital-at-risk equivalence matches the
    # equity-sleeve Kelly recommendation. If Kelly says 8% equity and
    # leverage is 4x, put 2% in LEAPS to get equivalent exposure.
    leap_pct = equity_size.pct_of_portfolio / max(1.0, leverage)
    # Cap LEAPS at 3% per name regardless
    leap_pct = min(0.03, leap_pct)

    # Breakeven: stock must rise to (strike + premium)
    breakeven_move = target_strike_otm + premium_pct

    rationale = (
        f"Approx delta {delta:.2f}, premium ~{premium_pct:.0%} of strike, "
        f"~{leverage:.1f}x leverage. Equity Kelly={equity_size.pct_of_portfolio:.2%} "
        f"-> LEAPS sized at {leap_pct:.2%}. Stock needs +{breakeven_move:.0%} "
        f"by expiry to break even. IV assumed {assumed_iv:.0%}; if actual IV "
        f"is materially higher, the position is too expensive."
    )
    return LeapRecommendation(
        underlying_ticker=underlying_ticker,
        strike_pct_otm=target_strike_otm,
        expiry_months_min=18,
        expiry_months_target=target_expiry_months,
        leverage_estimate=leverage,
        sizing_pct_of_portfolio=leap_pct,
        breakeven_underlying_move=breakeven_move,
        rationale=rationale,
    )
