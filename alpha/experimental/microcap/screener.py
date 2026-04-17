"""Negative-EV + quality screen at a point in time.

Screen definition (v2, tightened after MVP showed value traps):

  PASS IF ALL:
    1. Market cap $20M - $300M (microcap window)
    2. EV < 0 (net cash > market cap)
    3. MOST RECENT annual operating cash flow > 0
       (v1 used "3y sum > 0" which passed NTIP-style declining businesses
       whose OCF came from past settlements)
    4. TTM revenue >= $10M (v1 used $1M — too low, caught shells)
    5. Revenue not declining more than 25% YoY (v2 addition)
    6. Positive stockholders' equity
    7. SIC code not in BLACKLIST (holding/licensing structures that
       masquerade as operating businesses)

The intent: distinguish "forgotten cash-generating microcap" from
"declining business with legacy cash pile." The v1 screen failed that
distinction and flagged NTIP (patent licensor winding down) as a hit.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from alpha.experimental.microcap.fundamentals import FundamentalsTS


MAX_MCAP_USD = 300_000_000
MIN_MCAP_USD = 20_000_000
MIN_RECENT_ANNUAL_OCF_USD = 500_000        # recent annual, not 3y sum
MIN_TTM_REVENUE_USD = 10_000_000           # bumped from $1M
MAX_REVENUE_DECLINE_YOY = -0.25            # reject <-25% YoY

# SIC codes historically associated with shell/licensing/holdco structures
# that pass screen-based quality gates but have no ongoing operating business.
# Broad strokes; not exhaustive.
_SIC_BLACKLIST = {
    "6199",  # Finance services (incl. patent licensing shells)
    "6726",  # Investment offices
    "6770",  # Blank checks (SPACs)
    "6199",  # Finance services (dup ok)
    "6189",  # Asset-backed securities
}


def _is_blacklisted_sic(sic: str | None) -> bool:
    if not sic:
        return False
    sic4 = str(sic).zfill(4)
    return sic4 in _SIC_BLACKLIST


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
    *,
    sic: str | None = None,
    max_mcap: float = MAX_MCAP_USD,
    min_mcap: float = MIN_MCAP_USD,
) -> ScreenResult:
    result = ScreenResult(cik=fund.cik, as_of=as_of, pass_filter=False)

    # ---- Gate 0: SIC blacklist (shells / licensing / holdcos) ----
    if _is_blacklisted_sic(sic):
        result.reason = f"SIC {sic} blacklisted (shell/holdco)"
        return result

    # ---- Gate 1: market cap window ----
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

    # ---- Gate 2: balance sheet + EV ----
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
        result.reason = (f"EV ${ev/1e6:.0f}M >= 0 (no negative-EV)")
        return result

    # ---- Gate 3: recent annual OCF must be positive ----
    # Most recent 10-K-level OCF (not 3y sum — that passed NTIP wrongly).
    recent_ocf_pt = None
    for p in sorted(
        fund.by_field.get("operating_cash_flow", []),
        key=lambda x: x.end_date, reverse=True,
    ):
        if p.end_date > as_of:
            continue
        if p.form == "10-K" or (p.qtrs and p.qtrs >= 4):
            recent_ocf_pt = p
            break
    if recent_ocf_pt is None:
        result.reason = "no recent annual OCF report"
        return result
    if recent_ocf_pt.value < MIN_RECENT_ANNUAL_OCF_USD:
        result.reason = (
            f"recent annual OCF ${recent_ocf_pt.value/1e6:.1f}M "
            f"< ${MIN_RECENT_ANNUAL_OCF_USD/1e6:.1f}M threshold "
            "(business likely declining or one-off-dependent)"
        )
        return result

    # Keep 3y OCF for reporting
    ocf3 = fund.multi_year_sum("operating_cash_flow", as_of, years=3)
    result.ocf_3y_usd = ocf3

    # ---- Gate 4: revenue scale and stability ----
    rev_ttm = fund.ttm_sum("revenue", as_of)
    result.ttm_revenue_usd = rev_ttm
    if rev_ttm is None or rev_ttm < MIN_TTM_REVENUE_USD:
        result.reason = (
            f"TTM revenue ${(rev_ttm or 0)/1e6:.1f}M "
            f"< ${MIN_TTM_REVENUE_USD/1e6:.0f}M threshold"
        )
        return result

    # Revenue growth check: compare most recent 10-K revenue to prior year
    recent_rev_pt = None
    prior_rev_pt = None
    sorted_rev = sorted(
        (p for p in fund.by_field.get("revenue", [])
         if p.end_date <= as_of
         and (p.form == "10-K" or (p.qtrs and p.qtrs >= 4))),
        key=lambda p: p.end_date, reverse=True,
    )
    # Dedup by fiscal year
    seen_years: set = set()
    ranked: list = []
    for p in sorted_rev:
        fy = p.fiscal_year or p.end_date.year
        if fy in seen_years:
            continue
        seen_years.add(fy)
        ranked.append(p)
        if len(ranked) >= 2:
            break
    if len(ranked) >= 2:
        recent_rev_pt, prior_rev_pt = ranked[0], ranked[1]
        if prior_rev_pt.value > 0:
            growth = (recent_rev_pt.value / prior_rev_pt.value) - 1
            if growth < MAX_REVENUE_DECLINE_YOY:
                result.reason = (
                    f"revenue declining {growth:+.0%} YoY "
                    f"(threshold {MAX_REVENUE_DECLINE_YOY:+.0%})"
                )
                return result

    # ---- Passed all gates ----
    result.pass_filter = True
    result.reason = (
        f"NEGATIVE-EV + QUALITY: EV=${ev/1e6:.0f}M, "
        f"mcap=${market_cap_usd/1e6:.0f}M, "
        f"discount={result.discount_to_net_cash_pct:.0%}, "
        f"recent_OCF=${recent_ocf_pt.value/1e6:.1f}M, "
        f"TTM_rev=${rev_ttm/1e6:.0f}M"
    )
    result.metrics = {
        "cash": cash, "short_term_investments": sti,
        "long_term_debt": ltd, "current_debt": cdebt,
        "equity": equity_pt.value if equity_pt else None,
        "recent_annual_ocf": recent_ocf_pt.value,
    }
    return result
