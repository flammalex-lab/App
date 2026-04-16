"""Position ledger — track live and paper positions in SQLite.

Core operational data:
  - What do I own right now?
  - When was each bought?
  - What's the thesis (for review at close)?
  - Which sleeve (spinoff / special / cash)?
  - When should this position close (target hold + 18m)?

The ledger is the source of truth for portfolio state. It powers the
deploy queue (how many slots are free) and the paper trader (hypothetical
performance tracking).
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterator, Optional

from alpha.config import DATA_DIR


LEDGER_SCHEMA = """
CREATE TABLE IF NOT EXISTS ledger_positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mode            TEXT NOT NULL,               -- 'live' | 'paper'
    sleeve          TEXT NOT NULL,               -- 'spinoff' | 'special' | 'cash'
    ticker          TEXT,
    cik             TEXT,
    company         TEXT,
    entry_date      DATE NOT NULL,
    entry_price     REAL,
    shares          REAL,
    cost_basis      REAL,                        -- shares * entry_price (ex commissions)
    target_close    DATE,                        -- default: entry + 18 months
    thesis          TEXT,
    heuristic_flags TEXT,
    closed_date     DATE,
    close_price     REAL,
    realized_pnl    REAL,
    status          TEXT DEFAULT 'open',         -- 'open' | 'closed'
    notes           TEXT
);
CREATE INDEX IF NOT EXISTS ledger_status ON ledger_positions(mode, status);
CREATE INDEX IF NOT EXISTS ledger_sleeve ON ledger_positions(mode, sleeve);
"""


@dataclass
class Position:
    id: int | None = None
    mode: str = "paper"                # 'live' | 'paper'
    sleeve: str = "spinoff"
    ticker: str | None = None
    cik: str | None = None
    company: str = ""
    entry_date: date | None = None
    entry_price: float | None = None
    shares: float | None = None
    cost_basis: float | None = None
    target_close: date | None = None
    thesis: str = ""
    heuristic_flags: str = ""
    closed_date: date | None = None
    close_price: float | None = None
    realized_pnl: float | None = None
    status: str = "open"
    notes: str = ""


class Ledger:
    def __init__(self, path: Path | None = None):
        self.path = path or (DATA_DIR / "alpha.sqlite")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self) -> None:
        with self.conn() as c:
            c.executescript(LEDGER_SCHEMA)

    @contextmanager
    def conn(self) -> Iterator[sqlite3.Connection]:
        c = sqlite3.connect(self.path, detect_types=sqlite3.PARSE_DECLTYPES)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL;")
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def open_position(self, pos: Position) -> int:
        """Record a new position. Returns the new ID."""
        if pos.cost_basis is None and pos.shares and pos.entry_price:
            pos.cost_basis = pos.shares * pos.entry_price
        with self.conn() as c:
            cur = c.execute(
                """
                INSERT INTO ledger_positions
                  (mode, sleeve, ticker, cik, company, entry_date,
                   entry_price, shares, cost_basis, target_close,
                   thesis, heuristic_flags, status, notes)
                VALUES
                  (:mode, :sleeve, :ticker, :cik, :company, :entry_date,
                   :entry_price, :shares, :cost_basis, :target_close,
                   :thesis, :heuristic_flags, 'open', :notes)
                """,
                {
                    "mode": pos.mode, "sleeve": pos.sleeve,
                    "ticker": pos.ticker, "cik": pos.cik,
                    "company": pos.company,
                    "entry_date": pos.entry_date.isoformat()
                        if pos.entry_date else None,
                    "entry_price": pos.entry_price,
                    "shares": pos.shares,
                    "cost_basis": pos.cost_basis,
                    "target_close": pos.target_close.isoformat()
                        if pos.target_close else None,
                    "thesis": pos.thesis,
                    "heuristic_flags": pos.heuristic_flags,
                    "notes": pos.notes,
                },
            )
            return cur.lastrowid or 0

    def close_position(
        self, position_id: int, closed_date: date, close_price: float,
        notes: str = "",
    ) -> None:
        """Close a position, compute realized P&L."""
        with self.conn() as c:
            pos = c.execute(
                "SELECT shares, cost_basis FROM ledger_positions WHERE id=?",
                (position_id,),
            ).fetchone()
            if pos is None:
                raise ValueError(f"No position with id {position_id}")
            proceeds = (pos["shares"] or 0) * close_price
            pnl = proceeds - (pos["cost_basis"] or 0)
            c.execute(
                """
                UPDATE ledger_positions
                SET closed_date=?, close_price=?, realized_pnl=?,
                    status='closed', notes=COALESCE(?, notes)
                WHERE id=?
                """,
                (closed_date.isoformat(), close_price, pnl, notes, position_id),
            )

    def open_positions(self, mode: str = "paper",
                        sleeve: str | None = None) -> list[sqlite3.Row]:
        with self.conn() as c:
            if sleeve:
                return list(c.execute(
                    "SELECT * FROM ledger_positions "
                    "WHERE mode=? AND sleeve=? AND status='open' "
                    "ORDER BY entry_date",
                    (mode, sleeve),
                ))
            return list(c.execute(
                "SELECT * FROM ledger_positions "
                "WHERE mode=? AND status='open' ORDER BY entry_date",
                (mode,),
            ))

    def open_count(self, mode: str = "paper", sleeve: str = "spinoff") -> int:
        with self.conn() as c:
            row = c.execute(
                "SELECT COUNT(*) AS n FROM ledger_positions "
                "WHERE mode=? AND sleeve=? AND status='open'",
                (mode, sleeve),
            ).fetchone()
        return row["n"] if row else 0

    def closed_positions(self, mode: str = "paper") -> list[sqlite3.Row]:
        with self.conn() as c:
            return list(c.execute(
                "SELECT * FROM ledger_positions "
                "WHERE mode=? AND status='closed' ORDER BY closed_date DESC",
                (mode,),
            ))

    def performance(self, mode: str = "paper") -> dict:
        """Aggregate performance stats across closed positions."""
        rows = self.closed_positions(mode)
        if not rows:
            return {"n": 0}
        rets = [
            (r["realized_pnl"] or 0) / (r["cost_basis"] or 1)
            for r in rows if (r["cost_basis"] or 0) > 0
        ]
        if not rets:
            return {"n": 0}
        n = len(rets)
        wins = sum(1 for r in rets if r > 0)
        return {
            "n": n,
            "win_rate": wins / n,
            "mean_return": sum(rets) / n,
            "best": max(rets),
            "worst": min(rets),
            "total_pnl": sum(r["realized_pnl"] or 0 for r in rows),
        }
