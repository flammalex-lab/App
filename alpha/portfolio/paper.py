"""Paper trader: execute the deploy queue into the ledger as paper positions.

Invariants:
  - Max N concurrent positions (default 5)
  - Equal-weight allocation across filled slots
  - Positions auto-close on target_close (entry + 18 months)
  - Uses yfinance for mark-to-market at entry and close

The paper trader runs on a schedule (daily). Each run:
  1. Checks closed_date targets — any open position past target_close
     gets closed at that day's adjusted close.
  2. Reads ready_candidates from the queue — oldest-ready first.
  3. For each empty slot in the portfolio, deploys the next candidate.
  4. Persists everything to the ledger.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from alpha.portfolio.ledger import Ledger, Position
from alpha.portfolio.queue import DeployQueue

log = logging.getLogger("alpha.portfolio.paper")

DEFAULT_MAX_CONCURRENT = 5
DEFAULT_HOLD_DAYS = 18 * 30   # ~18 months
DEFAULT_STARTING_CAPITAL = 100_000


@dataclass
class TickerQuote:
    ticker: str
    date: date
    price: float


def _fetch_close_price(ticker: str, on_or_before: date,
                        lookback_days: int = 10) -> Optional[float]:
    """Adjusted close on or just before the given date."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        start = on_or_before - timedelta(days=lookback_days)
        end = on_or_before + timedelta(days=2)
        df = yf.download(
            ticker, start=start.isoformat(), end=end.isoformat(),
            progress=False, auto_adjust=True, threads=False,
        )
    except Exception as e:  # noqa: BLE001
        log.debug("yf fetch failed for %s: %s", ticker, e)
        return None
    if df is None or df.empty:
        return None
    col = "Close" if "Close" in df.columns else df.columns[0]
    series = df[col].dropna()
    if hasattr(series, "iloc") and not series.empty:
        # Squeeze multi-column if needed
        val = series.iloc[-1]
        try:
            return float(val)
        except Exception:  # noqa: BLE001
            return float(val.iloc[0]) if hasattr(val, "iloc") else None
    return None


class PaperTrader:
    """Execute the deploy queue into paper positions."""

    def __init__(
        self,
        ledger: Ledger | None = None,
        queue: DeployQueue | None = None,
        *,
        mode: str = "paper",
        max_concurrent: int = DEFAULT_MAX_CONCURRENT,
        starting_capital: float = DEFAULT_STARTING_CAPITAL,
        hold_days: int = DEFAULT_HOLD_DAYS,
    ):
        self.ledger = ledger or Ledger()
        self.queue = queue or DeployQueue()
        self.mode = mode
        self.max_concurrent = max_concurrent
        self.starting_capital = starting_capital
        self.hold_days = hold_days

    def _per_slot_allocation(self) -> float:
        """Equal-weight across max_concurrent slots."""
        return self.starting_capital / self.max_concurrent

    def step(self, today: date | None = None) -> dict:
        """One day of paper trading. Returns a summary dict."""
        today = today or date.today()
        closed = self._close_due_positions(today)
        deployed = self._deploy_ready_candidates(today)
        stale = self.queue.mark_stale(today)
        open_count = self.ledger.open_count(mode=self.mode, sleeve="spinoff")
        return {
            "date": today.isoformat(),
            "closed": closed,
            "deployed": deployed,
            "stale_marked": stale,
            "open_positions": open_count,
            "slots_available": max(0, self.max_concurrent - open_count),
        }

    def _close_due_positions(self, today: date) -> int:
        """Close any open positions whose target_close has passed."""
        closed = 0
        for row in self.ledger.open_positions(mode=self.mode, sleeve="spinoff"):
            target_close = row["target_close"]
            if not target_close:
                continue
            target_date = (
                date.fromisoformat(target_close)
                if isinstance(target_close, str) else target_close
            )
            if target_date > today:
                continue
            ticker = row["ticker"]
            close_price = (_fetch_close_price(ticker, today)
                           if ticker else None)
            if close_price is None:
                # Can't close cleanly; skip for now — will retry tomorrow
                continue
            self.ledger.close_position(
                position_id=row["id"], closed_date=today,
                close_price=close_price,
                notes="auto-closed at target hold",
            )
            closed += 1
        return closed

    def _deploy_ready_candidates(self, today: date) -> int:
        """Fill empty slots from the queue."""
        open_count = self.ledger.open_count(mode=self.mode, sleeve="spinoff")
        slots = self.max_concurrent - open_count
        if slots <= 0:
            return 0
        deployed = 0
        for cand in self.queue.ready_candidates(today=today,
                                                  only_tradeable=True):
            if slots <= 0:
                break
            ticker = cand["ticker"]
            if not ticker:
                continue
            price = _fetch_close_price(ticker, today)
            if price is None or price <= 0:
                continue
            allocation = self._per_slot_allocation()
            shares = allocation / price
            pos_id = self.ledger.open_position(Position(
                mode=self.mode, sleeve="spinoff",
                ticker=ticker, cik=cand["cik"], company=cand["company"],
                entry_date=today, entry_price=price, shares=shares,
                cost_basis=allocation,
                target_close=today + timedelta(days=self.hold_days),
                thesis="systematic spin-off deployment",
                heuristic_flags=cand["heuristic_flags"] or "",
            ))
            self.queue.mark_deployed(cand["accession"], pos_id)
            deployed += 1
            slots -= 1
            log.info("Paper deploy: %s @ %.2f (id=%d)", ticker, price, pos_id)
        return deployed
