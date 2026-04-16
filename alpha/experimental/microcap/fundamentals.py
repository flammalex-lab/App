"""Extract point-in-time fundamentals from SEC XBRL Company Facts API.

For a given CIK, pulls the JSON file and extracts time-series for
the core balance-sheet + cash-flow metrics needed for negative-EV
screening:

  - CashAndCashEquivalentsAtCarryingValue
  - ShortTermInvestments (optional, included in "cash-like")
  - LongTermDebt + LongTermDebtCurrent
  - StockholdersEquity
  - Revenues (and ASC 606 variant)
  - NetCashProvidedByOperatingActivities (operating cash flow)
  - CommonStockSharesOutstanding (for market cap calc)

Each XBRL fact is a (value, period_start, period_end, fiscal_year,
form) tuple. We keep the most recent as-of any given date.

This module CACHES aggressively via the EDGAR client's HTTP cache.
First pass through the universe is slow; subsequent runs are instant.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

log = logging.getLogger("alpha.microcap.fundamentals")


# Map our internal field names -> list of XBRL tags (first non-empty wins)
XBRL_TAGS: dict[str, list[str]] = {
    "cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "Cash",
        "CashAndCashEquivalents",
    ],
    "short_term_investments": [
        "ShortTermInvestments",
        "MarketableSecuritiesCurrent",
    ],
    "long_term_debt": [
        "LongTermDebt",
        "LongTermDebtNoncurrent",
    ],
    "current_debt": [
        "LongTermDebtCurrent",
        "ShortTermBorrowings",
        "DebtCurrent",
    ],
    "total_liabilities": [
        "Liabilities",
    ],
    "equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "assets": [
        "Assets",
    ],
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
    ],
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByOperatingActivities",
    ],
    "shares_outstanding": [
        "CommonStockSharesOutstanding",
        "EntityCommonStockSharesOutstanding",
    ],
}


@dataclass
class FactPoint:
    value: float
    end_date: date
    fiscal_year: int | None
    form: str
    fp: str | None = None        # fiscal period (e.g. FY, Q1, ...)
    qtrs: int | None = None


@dataclass
class FundamentalsTS:
    """Time-series of fundamentals for a single CIK."""
    cik: str
    by_field: dict[str, list[FactPoint]] = field(default_factory=dict)

    def latest_before(self, field_name: str, as_of: date,
                       max_age_days: int = 400) -> FactPoint | None:
        """Most recent fact for this field at or before `as_of`,
        within max_age_days (default ~13 months so stale data doesn't
        distort the screen)."""
        pts = self.by_field.get(field_name, [])
        best: FactPoint | None = None
        for p in pts:
            if p.end_date > as_of:
                continue
            if (as_of - p.end_date).days > max_age_days:
                continue
            if best is None or p.end_date > best.end_date:
                best = p
        return best

    def ttm_sum(self, field_name: str, as_of: date,
                 min_periods: int = 3) -> float | None:
        """Trailing-twelve-month sum (for flow variables like revenue,
        operating cash flow). Uses annual reports when available;
        falls back to summing quarterly."""
        pts = sorted(
            (p for p in self.by_field.get(field_name, [])
             if p.end_date <= as_of
             and (as_of - p.end_date).days <= 400),
            key=lambda p: p.end_date, reverse=True,
        )
        if not pts:
            return None
        # Prefer a recent 10-K (annual) report
        for p in pts:
            if p.form == "10-K" or (p.qtrs and p.qtrs >= 4):
                return p.value
        # Fall back: sum the last 4 quarterly values if we can identify them
        quarterly = [p for p in pts if p.qtrs == 1][:4]
        if len(quarterly) >= min_periods:
            return sum(p.value for p in quarterly)
        return None

    def multi_year_sum(self, field_name: str, as_of: date,
                        years: int = 3) -> float | None:
        """Sum of annual values for the last N years. Used for quality
        gate (e.g., 3y cumulative operating cash flow > 0)."""
        pts = sorted(
            (p for p in self.by_field.get(field_name, [])
             if p.end_date <= as_of
             and (p.form == "10-K" or (p.qtrs and p.qtrs >= 4))),
            key=lambda p: p.end_date, reverse=True,
        )
        # dedup by fiscal_year
        seen_years: set = set()
        chosen: list[FactPoint] = []
        for p in pts:
            fy = p.fiscal_year or p.end_date.year
            if fy in seen_years:
                continue
            seen_years.add(fy)
            chosen.append(p)
            if len(chosen) >= years:
                break
        if len(chosen) < years:
            return None
        return sum(p.value for p in chosen)


def _parse_date(s: str) -> date | None:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def fetch_fundamentals(edgar, cik: str) -> FundamentalsTS | None:
    """Pull the Company Facts JSON for a CIK and parse into a
    FundamentalsTS. Uses EDGAR client's on-disk cache so subsequent
    calls are free."""
    cik10 = str(cik).zfill(10)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik10}.json"
    try:
        raw = edgar._get(url, host="data.sec.gov", use_cache=True)
    except Exception as e:  # noqa: BLE001
        log.debug("companyfacts fetch failed for %s: %s", cik10, e)
        return None
    try:
        facts = json.loads(raw)
    except json.JSONDecodeError:
        return None

    gaap = facts.get("facts", {}).get("us-gaap", {})
    ts = FundamentalsTS(cik=cik10)

    for field_name, tags in XBRL_TAGS.items():
        points: list[FactPoint] = []
        for tag in tags:
            units = gaap.get(tag, {}).get("units", {})
            # Prefer USD for dollar figures, shares for share counts
            for unit_key in ("USD", "shares", "USD/shares"):
                entries = units.get(unit_key, [])
                if not entries:
                    continue
                for e in entries:
                    d = _parse_date(e.get("end", ""))
                    if not d:
                        continue
                    val = e.get("val")
                    if val is None:
                        continue
                    try:
                        val = float(val)
                    except (ValueError, TypeError):
                        continue
                    points.append(FactPoint(
                        value=val, end_date=d,
                        fiscal_year=e.get("fy"),
                        form=e.get("form", ""),
                        fp=e.get("fp"),
                        qtrs=e.get("qtrs"),
                    ))
            if points:
                break  # first matching tag wins per field
        ts.by_field[field_name] = points

    return ts if any(ts.by_field.values()) else None
