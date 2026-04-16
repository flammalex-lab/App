"""Classify spin-offs by newco market cap size tier.

Walk-forward validated buckets (2015-2024, n=61 tradeable):
  - nano (<$500M):    +47.9% excess vs IWM at 18m
  - small ($500M-$2B): +39.9% excess vs IWM at 18m
  - mid ($2B-$10B):    +7.1% excess (THE TRAP — avoid)
  - large (>$10B):     +23.0% excess at 18m

We systematically deploy to nano + small only. Mid spins are the
documented worst category. Large spins are OK but rare and often
better captured via other vehicles.
"""
from __future__ import annotations

from typing import Literal

SizeBucket = Literal[
    "nano (<$500M)",
    "small ($500M-$2B)",
    "mid ($2B-$10B)",
    "large (>$10B)",
    "unknown",
]


# Production-default: only nano + small are tradeable
TRADEABLE_BUCKETS: frozenset[SizeBucket] = frozenset({
    "nano (<$500M)",
    "small ($500M-$2B)",
})


def classify_size(market_cap_usd: float | None) -> SizeBucket:
    """Classify a newco market cap into a size bucket.

    Returns 'unknown' if market cap is missing or non-positive.
    """
    if market_cap_usd is None or market_cap_usd <= 0:
        return "unknown"
    if market_cap_usd < 500_000_000:
        return "nano (<$500M)"
    if market_cap_usd < 2_000_000_000:
        return "small ($500M-$2B)"
    if market_cap_usd < 10_000_000_000:
        return "mid ($2B-$10B)"
    return "large (>$10B)"


def size_bucket_ok(bucket: SizeBucket) -> bool:
    """Is this bucket in the tradeable set?"""
    return bucket in TRADEABLE_BUCKETS
