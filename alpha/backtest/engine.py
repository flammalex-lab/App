"""Walk-forward backtesting harness.

Minimal but realistic:
- Point-in-time rebalances; no look-ahead.
- Configurable transaction cost model (bps of notional + half-spread).
- Equal-weight or score-weighted sizing.
- Reports CAGR, vol, Sharpe, max drawdown, turnover.

Data input: a pandas DataFrame with columns
    [date, ticker, adj_close, market_cap, universe_flag]
Signal input: a callable strategy(date, available_data) -> list[ticker]

The data loader is pluggable — you can wire this up to Sharadar,
Polygon, or your own Parquet files.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Callable, Protocol

import numpy as np
import pandas as pd


@dataclass
class StrategyRule:
    name: str
    # signature: (as_of: date, panel: pd.DataFrame) -> list[tuple[ticker, weight]]
    rank_fn: Callable[[date, pd.DataFrame], list[tuple[str, float]]]
    rebalance: str = "M"        # 'M' | 'Q' | 'W'
    max_positions: int = 20
    cost_bps: float = 10         # one-way bps
    slippage_bps: float = 5      # half-spread proxy


@dataclass
class BacktestResult:
    equity: pd.Series
    trades: pd.DataFrame
    stats: dict[str, float] = field(default_factory=dict)

    def summary(self) -> str:
        s = self.stats
        return "\n".join([
            f"CAGR:        {s.get('cagr', 0):.2%}",
            f"Vol:         {s.get('vol', 0):.2%}",
            f"Sharpe:      {s.get('sharpe', 0):.2f}",
            f"Max DD:      {s.get('max_dd', 0):.2%}",
            f"Turnover:    {s.get('turnover', 0):.2%}",
            f"Hit rate:    {s.get('hit_rate', 0):.2%}",
        ])


class Backtester:
    def __init__(self, prices: pd.DataFrame, rule: StrategyRule,
                 starting_capital: float = 100_000):
        """
        prices: long-format DataFrame with MultiIndex [date, ticker] and
                columns ['adj_close', 'market_cap', 'in_universe'].
        """
        req = {"adj_close", "market_cap", "in_universe"}
        missing = req - set(prices.columns)
        if missing:
            raise ValueError(f"prices missing required columns: {missing}")
        self.prices = prices.sort_index()
        self.rule = rule
        self.cap0 = starting_capital

    def run(self) -> BacktestResult:
        # Rebalance date schedule
        all_dates = self.prices.index.get_level_values(0).unique().sort_values()
        rebalances = self._rebalance_dates(all_dates)

        capital = self.cap0
        weights: dict[str, float] = {}
        equity_curve: list[tuple[pd.Timestamp, float]] = []
        trades: list[dict] = []

        prev_prices: dict[str, float] = {}

        for d in all_dates:
            snap = self.prices.xs(d, level=0, drop_level=False)
            # Mark to market
            if weights:
                ret = 0.0
                for t, w in weights.items():
                    px = _px_for(snap, t)
                    prev = prev_prices.get(t)
                    if px is not None and prev is not None and prev > 0:
                        ret += w * (px / prev - 1)
                capital *= (1 + ret)
            equity_curve.append((d, capital))

            # Update previous prices for tomorrow's MTM
            for t in weights:
                px = _px_for(snap, t)
                if px is not None:
                    prev_prices[t] = px

            if d in rebalances:
                panel = self.prices.loc[:d].copy()
                ranks = self.rule.rank_fn(d.date() if hasattr(d, "date") else d,
                                          panel)
                ranks = ranks[: self.rule.max_positions]
                tot = sum(w for _, w in ranks) or 1.0
                new_weights = {t: w / tot for t, w in ranks}
                # Apply transaction cost on the TO leg
                turnover = _turnover(weights, new_weights)
                cost = turnover * (self.rule.cost_bps + self.rule.slippage_bps) / 10_000
                capital *= (1 - cost)
                trades.append({"date": d, "turnover": turnover, "cost_drag": cost,
                               "n_positions": len(new_weights)})
                weights = new_weights
                prev_prices = {
                    t: _px_for(snap, t) or prev_prices.get(t, 0.0)
                    for t in weights
                }

        eq = pd.Series(
            dict(equity_curve), name="equity"
        ).sort_index()
        trades_df = pd.DataFrame(trades)
        return BacktestResult(equity=eq, trades=trades_df, stats=_stats(eq, trades_df))

    @staticmethod
    def _rebalance_dates(all_dates: pd.DatetimeIndex) -> set:
        s = pd.Series(index=all_dates, data=1)
        freq = s.resample("ME" if False else "M").last()   # month-end
        return set(freq.dropna().index)


def _px_for(snap: pd.DataFrame, ticker: str) -> float | None:
    try:
        return float(snap.xs(ticker, level=1)["adj_close"].iloc[0])
    except (KeyError, IndexError):
        return None


def _turnover(old: dict[str, float], new: dict[str, float]) -> float:
    keys = set(old) | set(new)
    return sum(abs(new.get(k, 0) - old.get(k, 0)) for k in keys) / 2


def _stats(equity: pd.Series, trades: pd.DataFrame) -> dict[str, float]:
    if equity.empty:
        return {}
    rets = equity.pct_change().dropna()
    if rets.empty:
        return {}
    years = (equity.index[-1] - equity.index[0]).days / 365.25 or 1
    cagr = (equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1
    vol = rets.std() * np.sqrt(252)
    sharpe = (rets.mean() * 252) / (rets.std() * np.sqrt(252)) if rets.std() else 0
    rolling_max = equity.cummax()
    dd = (equity / rolling_max - 1).min()
    turnover_avg = trades["turnover"].mean() if not trades.empty else 0
    hit = (rets > 0).mean()
    return {
        "cagr": float(cagr),
        "vol": float(vol),
        "sharpe": float(sharpe),
        "max_dd": float(dd),
        "turnover": float(turnover_avg),
        "hit_rate": float(hit),
    }


# -------- example strategy rule: magic formula with quality overlay --------
def magic_formula_rank(as_of: date, panel: pd.DataFrame) -> list[tuple[str, float]]:
    """
    Reference implementation. Expects `panel` to carry the required fields in
    its columns (ebit_ev_yield, return_on_capital, in_universe, piotroski_f,
    altman_z, market_cap). Returns equal-weight candidates.
    """
    snap = panel.xs(panel.index.get_level_values(0).max(), level=0)
    snap = snap[snap["in_universe"] == 1]
    if snap.empty:
        return []
    snap = snap.copy()
    snap["rank_yield"] = snap["ebit_ev_yield"].rank(ascending=False)
    snap["rank_roc"]   = snap["return_on_capital"].rank(ascending=False)
    snap["composite"]  = snap["rank_yield"] + snap["rank_roc"]
    if "piotroski_f" in snap.columns:
        snap = snap[snap["piotroski_f"] >= 6]
    if "altman_z" in snap.columns:
        snap = snap[snap["altman_z"] >= 1.81]
    snap = snap.sort_values("composite")
    return [(t, 1.0) for t in snap.index[:30]]
