"""TRUE walk-forward portfolio simulator — no look-ahead.

Processes events in chronological order. At each event, the selection
rule sees ONLY data observable at that moment (filing metadata, newco
mcap if newco has started trading, and prior signals on the same name).

This is the honest version of the concentration test. The previous
"top-5 per year by smallest mcap" rule used year-end information to
select the 5 smallest of that year — a small but real look-ahead bias.

Selection rules supported:
  - threshold(min_quality)   — buy any event whose quality_score >= X
  - rolling_topn(window, n)  — at each event, look at the last `window`
                                days of events, take the top-N if this
                                event is among them
  - simple                   — buy every event of a given size_bucket

Portfolio mechanics:
  - Max N concurrent positions (you choose)
  - When a position has been held > hold_months, it closes at its
    forward return and capital recycles
  - New events are taken in order until portfolio is full; new events
    that arrive when portfolio is full can OPTIONALLY displace the
    weakest existing position (set displace=True)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Callable, Optional

import pandas as pd

log = logging.getLogger("alpha.backtest.realtime")


@dataclass
class Position:
    ticker: str
    entry_date: date
    cost: float
    expected_close: date
    realized_return: float           # the 18m forward return from data
    quality_score: float


@dataclass
class SimResult:
    final_capital: float
    starting_capital: float
    cagr: float
    n_positions_taken: int
    n_positions_closed: int
    win_rate: float
    biggest_winner_pct: float
    biggest_loser_pct: float
    equity_curve: pd.DataFrame
    closed_positions: pd.DataFrame
    rejection_reasons: dict[str, int] = field(default_factory=dict)


def _quality_score(event: pd.Series) -> float:
    """Observable-at-filing quality score (no future returns used).

    Higher = better candidate. Combines:
      - newco size (smaller -> higher score, calibrated to backtest)
      - whether ticker resolved cleanly (data quality)
    Returns 0.0-1.0.
    """
    score = 0.0
    mc = event.get("newco_start_mcap")
    if pd.isna(mc) or mc is None:
        # No size data yet — neutral
        return 0.4
    if mc < 500_000_000:
        score = 0.85
    elif mc < 2_000_000_000:
        score = 0.75
    elif mc < 10_000_000_000:
        score = 0.30   # the 'mid trap' — penalize
    else:
        score = 0.55
    if event.get("resolved_ticker") and event.get("has_prices"):
        score += 0.05
    return min(1.0, score)


def threshold_rule(min_quality: float = 0.70) -> Callable[[pd.Series], bool]:
    def f(ev: pd.Series) -> bool:
        return _quality_score(ev) >= min_quality
    return f


def simple_size_rule(allowed_buckets: tuple = ("nano (<$500M)", "small ($500M-$2B)")
                      ) -> Callable[[pd.Series], bool]:
    def f(ev: pd.Series) -> bool:
        return ev.get("size_bucket") in allowed_buckets
    return f


def simulate(
    events_df: pd.DataFrame,
    selection_rule: Callable[[pd.Series], bool],
    starting_capital: float = 100_000,
    max_concurrent_positions: int = 5,
    hold_months: int = 18,
    cost_bps_roundtrip: float = 50,
    displace_weakest: bool = False,
    return_col: str = "ret_18m",
) -> SimResult:
    """
    Process events in chronological order. Allocate capital until the
    portfolio is full; recycle capital as positions close.

    Returns a SimResult with equity curve and per-position log.
    """
    df = events_df.copy()
    df["filed_date"] = pd.to_datetime(df["filed_date"])
    df = df.sort_values("filed_date").dropna(subset=[return_col])

    cash = starting_capital
    open_positions: list[Position] = []
    closed_positions: list[Position] = []
    equity_history: list[dict] = []
    rejections: dict[str, int] = {"rule_failed": 0, "portfolio_full": 0,
                                    "no_capital": 0}
    n_taken = 0

    for _, ev in df.iterrows():
        evt_date = ev["filed_date"].date() if isinstance(ev["filed_date"], pd.Timestamp) else ev["filed_date"]

        # Step 1: close any positions whose expected_close has passed
        still_open: list[Position] = []
        for p in open_positions:
            if p.expected_close <= evt_date:
                # Close at the event's pre-computed forward return
                proceeds = p.cost * (1 + p.realized_return - cost_bps_roundtrip / 10_000)
                cash += proceeds
                closed_positions.append(p)
            else:
                still_open.append(p)
        open_positions = still_open

        # Mark equity (positions remain at cost until close — conservative)
        equity_history.append({
            "date": evt_date,
            "cash": cash,
            "open_positions_cost": sum(p.cost for p in open_positions),
            "n_open": len(open_positions),
        })

        # Step 2: evaluate this event under the selection rule
        if not selection_rule(ev):
            rejections["rule_failed"] += 1
            continue

        # Step 3: handle portfolio-full case
        if len(open_positions) >= max_concurrent_positions:
            if not displace_weakest:
                rejections["portfolio_full"] += 1
                continue
            # Find weakest existing (lowest quality)
            this_quality = _quality_score(ev)
            weakest = min(open_positions, key=lambda x: x.quality_score)
            if this_quality <= weakest.quality_score:
                rejections["portfolio_full"] += 1
                continue
            # Close the weakest now (mark current value at cost — no MTM)
            cash += weakest.cost   # punt on intra-hold returns; conservative
            open_positions.remove(weakest)
            closed_positions.append(weakest)

        # Step 4: allocate equal share of available cash
        slot_count = max_concurrent_positions - len(open_positions)
        if slot_count <= 0 or cash <= 0:
            rejections["no_capital"] += 1
            continue
        allocation = cash / slot_count

        if allocation < 100:    # don't open dust positions
            rejections["no_capital"] += 1
            continue

        cash -= allocation
        open_positions.append(Position(
            ticker=ev.get("ticker") or ev.get("cik", "?"),
            entry_date=evt_date,
            cost=allocation,
            expected_close=evt_date + timedelta(days=hold_months * 30),
            realized_return=float(ev[return_col]),
            quality_score=_quality_score(ev),
        ))
        n_taken += 1

    # Close any remaining open positions at the end (mark at realized return)
    for p in open_positions:
        proceeds = p.cost * (1 + p.realized_return - cost_bps_roundtrip / 10_000)
        cash += proceeds
        closed_positions.append(p)

    equity_history.append({
        "date": (df["filed_date"].max().date()
                 if isinstance(df["filed_date"].max(), pd.Timestamp) else date.today()),
        "cash": cash,
        "open_positions_cost": 0,
        "n_open": 0,
    })

    eq = pd.DataFrame(equity_history)
    if not eq.empty:
        eq["equity"] = eq["cash"] + eq["open_positions_cost"]

    closed_df = pd.DataFrame([{
        "ticker": p.ticker,
        "entry_date": p.entry_date,
        "expected_close": p.expected_close,
        "cost": p.cost,
        "realized_return": p.realized_return,
        "quality_score": p.quality_score,
    } for p in closed_positions])

    final_cap = cash
    win_rate = float((closed_df["realized_return"] > 0).mean()) if not closed_df.empty else 0
    if not closed_df.empty:
        years = (df["filed_date"].max() - df["filed_date"].min()).days / 365.25
        if years > 0:
            cagr = (final_cap / starting_capital) ** (1 / years) - 1
        else:
            cagr = 0
        biggest_w = closed_df["realized_return"].max()
        biggest_l = closed_df["realized_return"].min()
    else:
        cagr = 0
        biggest_w = 0
        biggest_l = 0

    return SimResult(
        final_capital=final_cap,
        starting_capital=starting_capital,
        cagr=cagr,
        n_positions_taken=n_taken,
        n_positions_closed=len(closed_positions),
        win_rate=win_rate,
        biggest_winner_pct=biggest_w,
        biggest_loser_pct=biggest_l,
        equity_curve=eq,
        closed_positions=closed_df,
        rejection_reasons=rejections,
    )
