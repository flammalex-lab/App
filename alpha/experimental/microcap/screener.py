"""Negative-EV + quality screen at a point in time.

Screen definition (Carlisle's Acquirer's Multiple lineage, tightened):

  PASS IF ALL:
    1. Market cap <= MAX_MCAP (microcap ceiling)
    2. Market cap >= MIN_MCAP (not ultra-micro shells)
    3. Net cash (cash + STI - long-term debt - current debt) > market cap
       (i.e., EV < 0)
    4. 3-year cumulative operating cash flow > 0

  REJECT IF ANY:
    - Negative stockholders' equity (book-value distressed)
    - No reported revenue in last 24 months

The screen is intentionally strict on quality to filter out the
value-trap micro-caps (dying businesses burning their cash). The
thesis is that genuinely negative-EV + cash-generating micro-caps
exist because nobody's paying attention, not because they're failing.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from alpha.experimental.microcap.fundamentals import FundamentalsTS


MAX_MCAP_USD = 300_000_000       # <= $300M = microcap ceiling
MIN_MCAP_USD = 20_000_000        # >= $20M to avoid total dust


@dataclass
class ScreenResult:
    cik: str
    as_of: date
    pass_filter: bool
    market_cap_usd: Optional[float] = None
    net_cash_usd: Optional[float] = None
    ev_usd: Optional[float] = None
    discount_to_net_cash_pct: Optional[float] = None
    ocf_3y_usd: Optional[float] = None
    ttm_revenue_usd: Optional[float] = None
    reason: str = ""
    # Full snapshot for later analysis
    metrics: dict = None


def screen_at_date(
    fund: FundamentalsTS,
    as_of: date,
    market_cap_usd: float | None,
    max_mcap: float = MAX_MCAP_USD,
    min_mcap: float = MIN_MCAP_USD,
) -> ScreenResult:
    result = ScreenResult(cik=fund.cik, as_of=as_of, pass_filter=False)

    if market_cap_usd is None or market_cap_usd <= 0:
        result.reason = "no market cap"
        return result
    result.market_cap_usd = market_cap_usd

    if market_cap_usd > max_mcap:
        result.reason = f"mcap ${market_cap_usd/1e6:.0f}M > ${max_mcap/1e6:.0f}M"
        return result
    if market_cap_usd < min_mcap:
        result.reason = f"mcap ${market_cap_usd/1e6:.0f}M < ${min_mcap/1e6:.0f}M"
        return result

    # Balance sheet
    cash_pt = fund.latest_before("cash", as_of)
    sti_pt = fund.latest_before("short_term_investments", as_of)
    ltd_pt = fund.latest_before("long_term_debt", as_of)
    cdebt_pt = fund.latest_before("current_debt", as_of)
    equity_pt = fund.latest_before("equity", as_of)

    if cash_pt is None:
        result.reason = "no cash data"
        return result
    cash = cash_pt.value
    sti = sti_pt.value if sti_pt else 0.0
    ltd = ltd_pt.value if ltd_pt else 0.0
    cdebt = cdebt_pt.value if cdebt_pt else 0.0
    net_cash = cash + sti - ltd - cdebt
    ev = market_cap_usd - net_cash
    result.net_cash_usd = net_cash
    result.ev_usd = ev
    result.discount_to_net_cash_pct = (
        (net_cash - market_cap_usd) / market_cap_usd
        if market_cap_usd > 0 else None
    )

    if equity_pt is not None and equity_pt.value < 0:
        result.reason = "negative book equity"
        return result

    if ev >= 0:
        result.reason = (f"EV ${ev/1e6:.0f}M >= 0 "
                          f"(mcap ${market_cap_usd/1e6:.0f}M, "
                          f"net cash ${net_cash/1e6:.0f}M)")
        return result

    # Quality gate: 3-year cumulative operating cash flow > 0
    ocf3 = fund.multi_year_sum("operating_cash_flow", as_of, years=3)
    result.ocf_3y_usd = ocf3
    if ocf3 is None:
        result.reason = "insufficient OCF history (need 3 annual reports)"
        return result
    if ocf3 <= 0:
        result.reason = f"3y OCF ${ocf3/1e6:.0f}M <= 0 (cash-burning)"
        return result

    # Revenue sanity
    rev_ttm = fund.ttm_sum("revenue", as_of)
    result.ttm_revenue_usd = rev_ttm
    if rev_ttm is None or rev_ttm < 1_000_000:
        result.reason = "no / trivial revenue (likely shell)"
        return result

    # Passed all gates
    result.pass_filter = True
    result.reason = (f"NEGATIVE-EV + QUALITY: EV=${ev/1e6:.0f}M, "
                      f"mcap=${market_cap_usd/1e6:.0f}M, "
                      f"discount_to_net_cash={result.discount_to_net_cash_pct:.0%}, "
                      f"3y OCF=${ocf3/1e6:.0f}M")
    result.metrics = {
        "cash": cash, "short_term_investments": sti,
        "long_term_debt": ltd, "current_debt": cdebt,
        "equity": equity_pt.value if equity_pt else None,
    }
    return result
