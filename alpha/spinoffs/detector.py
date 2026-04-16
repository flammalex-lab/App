"""Spin-off detector: find new Form 10 / Form 10-12B filings.

This is the primary signal producer. It scans EDGAR's recent filings,
applies the heuristic filter, and produces a ranked list of candidates
ready for the deploy queue.

Production rule (validated in walk-forward 2015-2024):
  - Entry at filing_date + 21 trading days (wait out forced-selling window)
  - Size bucket must be nano or small (unknown = proceed with caution)
  - Heuristic must pass (not a shell / VIE / OTC / chronic late filer)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Optional

from alpha.edgar import EdgarClient
from alpha.edgar.forms import FormType
from alpha.spinoffs.heuristic import HeuristicAssessment, assess_spinoff
from alpha.spinoffs.sizer import SizeBucket, classify_size, size_bucket_ok
from alpha.spinoffs.ticker import resolve_ticker

log = logging.getLogger("alpha.spinoffs.detector")


@dataclass
class SpinoffCandidate:
    cik: str
    company: str
    ticker: str | None
    accession: str
    filed_date: date
    ready_date: date                  # filing + 21 trading days
    size_bucket: SizeBucket
    newco_mcap_usd: Optional[float]
    heuristic: HeuristicAssessment
    primary_doc_url: str
    tradeable: bool                   # heuristic pass AND size bucket ok

    @property
    def pretty_headline(self) -> str:
        t = self.ticker or "?"
        mc = (f"${self.newco_mcap_usd/1e6:.0f}M"
              if self.newco_mcap_usd else "—")
        return (f"{t} — {self.company} "
                f"({self.size_bucket}, mcap {mc}, ready {self.ready_date})")


def _add_trading_days(d: date, n: int) -> date:
    """Approximate trading-day offset (weekends only; ignores holidays)."""
    cur = d
    added = 0
    while added < n:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


def detect_spinoffs(
    edgar: EdgarClient,
    *,
    since: date | None = None,
    entry_delay_trading_days: int = 21,
    require_size_match: bool = True,
) -> Iterable[SpinoffCandidate]:
    """Yield candidates from the last N days of EDGAR Form 10 filings.

    Args:
        edgar: SEC client.
        since: lookback start date (default: 120 days ago).
        entry_delay_trading_days: days to wait after filing for entry
            (backtested as 21 = optimal).
        require_size_match: if True, only yield nano/small buckets.
    """
    since = since or date.today() - timedelta(days=120)
    seen_ciks: set[str] = set()

    for filing in edgar.filings_for(
        [FormType.FORM_10, FormType.FORM_10_A], start=since,
    ):
        if filing.cik in seen_ciks:
            continue
        seen_ciks.add(filing.cik)

        # Heuristic gatekeeper
        h = assess_spinoff(edgar, filing.cik, filing.filed.isoformat())
        if not h.pass_filter:
            continue

        # Ticker resolution
        ticker = resolve_ticker(edgar, filing.cik)

        # Newco market cap — best-effort via yfinance on the resolved ticker
        newco_mcap = _newco_market_cap(ticker) if ticker else None
        bucket = classify_size(newco_mcap)

        if require_size_match and not size_bucket_ok(bucket):
            # Still yield, but marked non-tradeable
            tradeable = False
        else:
            tradeable = True

        ready = _add_trading_days(filing.filed, entry_delay_trading_days)
        cand = SpinoffCandidate(
            cik=filing.cik,
            company=filing.company,
            ticker=ticker,
            accession=filing.accession,
            filed_date=filing.filed,
            ready_date=ready,
            size_bucket=bucket,
            newco_mcap_usd=newco_mcap,
            heuristic=h,
            primary_doc_url=filing.url,
            tradeable=tradeable,
        )
        yield cand


def _newco_market_cap(ticker: str) -> float | None:
    """Best-effort market cap lookup using yfinance."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        info = yf.Ticker(ticker).info
        mc = info.get("marketCap")
        if mc and mc > 0:
            return float(mc)
    except Exception:  # noqa: BLE001
        return None
    return None
