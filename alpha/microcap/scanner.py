"""Production microcap scanner.

Scans the SEC universe for negative-EV microcaps with quality gates.
Produces candidates for the deploy queue, tagged with sleeve='microcap'.

Cadence: run quarterly (after 10-K/Q filing season). Unlike spinoffs
which are event-triggered (Form 10 daily), microcap is screen-triggered.

Recommended schedule:
  - Late Feb (post Q4 10-K season)
  - Late May (post Q1 10-Q season)
  - Late Aug (post Q2 10-Q season)
  - Late Nov (post Q3 10-Q season)
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterator

from alpha.edgar import EdgarClient
from alpha.experimental.microcap.fundamentals import fetch_fundamentals
from alpha.experimental.microcap.screener import screen_at_date
from alpha.experimental.microcap.universe import load_universe, UniverseEntry

log = logging.getLogger("alpha.microcap.scanner")


@dataclass
class MicrocapCandidate:
    cik: str
    ticker: str
    company: str
    screen_date: date
    market_cap_usd: float
    ev_usd: float
    net_cash_usd: float
    discount_to_net_cash_pct: float
    recent_ocf_usd: float | None
    ttm_revenue_usd: float | None
    sleeve: str = "microcap"

    @property
    def pretty_headline(self) -> str:
        disc = self.discount_to_net_cash_pct or 0
        return (
            f"{self.ticker} — {self.company} "
            f"(mcap ${self.market_cap_usd/1e6:.0f}M, "
            f"EV ${self.ev_usd/1e6:.0f}M, "
            f"disc {disc:.0%})"
        )


def _price_near_date(ticker: str, target: date) -> float | None:
    """Get adjusted close on or near target date via yfinance."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        start = target - timedelta(days=10)
        end = target + timedelta(days=2)
        df = yf.download(
            ticker, start=start.isoformat(), end=end.isoformat(),
            progress=False, auto_adjust=True, threads=False,
        )
    except Exception:  # noqa: BLE001
        return None
    if df is None or df.empty:
        return None
    col = "Close" if "Close" in df.columns else df.columns[0]
    series = df[col].dropna()
    if isinstance(series, __import__("pandas").DataFrame):
        series = series.iloc[:, 0]
    if series.empty:
        return None
    return float(series.iloc[-1])


def scan_microcap_candidates(
    edgar: EdgarClient,
    *,
    screen_date: date | None = None,
    pause_s: float = 0.1,
) -> Iterator[MicrocapCandidate]:
    """Scan the full SEC universe for negative-EV microcaps.

    Args:
        edgar: SEC client.
        screen_date: the as-of date for the screen. Defaults to today
            (use the most recent fundamentals available).
        pause_s: seconds between CIK fetches (SEC rate limit politeness).

    Yields MicrocapCandidate for each name that passes all quality gates.
    """
    screen_date = screen_date or date.today()
    universe = load_universe(edgar, filter_common_only=True)
    log.info("Scanning %d CIKs for negative-EV microcaps @ %s",
             len(universe), screen_date)

    hits = 0
    for i, entry in enumerate(universe):
        if i and i % 500 == 0:
            log.info("  ...%d/%d CIKs, %d hits", i, len(universe), hits)

        try:
            fund = fetch_fundamentals(edgar, entry.cik)
        except Exception:  # noqa: BLE001
            continue
        if fund is None:
            continue

        # Get SIC for blacklist check
        sic: str | None = None
        try:
            subs = edgar.company_submissions(entry.cik)
            sic = str(subs.get("sic", "") or "").strip() or None
        except Exception:  # noqa: BLE001
            pass

        # Shares outstanding for market cap
        shares_pt = fund.latest_before("shares_outstanding", screen_date,
                                         max_age_days=400)
        if shares_pt is None or shares_pt.value <= 0:
            continue

        price = _price_near_date(entry.ticker, screen_date)
        if price is None or price <= 0:
            continue

        market_cap = shares_pt.value * price
        res = screen_at_date(fund, screen_date, market_cap, sic=sic)
        if not res.pass_filter:
            continue

        hits += 1
        yield MicrocapCandidate(
            cik=entry.cik,
            ticker=entry.ticker,
            company=entry.name,
            screen_date=screen_date,
            market_cap_usd=res.market_cap_usd or market_cap,
            ev_usd=res.ev_usd or 0,
            net_cash_usd=res.net_cash_usd or 0,
            discount_to_net_cash_pct=res.discount_to_net_cash_pct or 0,
            recent_ocf_usd=None,
            ttm_revenue_usd=res.ttm_revenue_usd,
        )
        time.sleep(pause_s)

    log.info("Scan complete: %d hits from %d CIKs", hits, len(universe))
