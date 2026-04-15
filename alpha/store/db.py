"""SQLite wrapper. Small enough to keep in one module."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from alpha.config import DATA_DIR

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


class Store:
    def __init__(self, path: Path | None = None):
        self.path = path or (DATA_DIR / "alpha.sqlite")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self) -> None:
        with self.conn() as c:
            c.executescript(SCHEMA_PATH.read_text())

    @contextmanager
    def conn(self) -> Iterator[sqlite3.Connection]:
        c = sqlite3.connect(self.path, detect_types=sqlite3.PARSE_DECLTYPES)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL;")
        c.execute("PRAGMA foreign_keys=ON;")
        try:
            yield c
            c.commit()
        finally:
            c.close()

    # --- filings ---------------------------------------------------------
    def upsert_filing(self, row: dict[str, Any]) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT OR IGNORE INTO filings
                  (accession, cik, company, ticker, form, filed_date, primary_doc, url)
                VALUES (:accession, :cik, :company, :ticker, :form,
                        :filed_date, :primary_doc, :url)
                """,
                row,
            )

    def recent_filings(self, form: str, limit: int = 100) -> list[sqlite3.Row]:
        with self.conn() as c:
            return list(
                c.execute(
                    "SELECT * FROM filings WHERE form=? ORDER BY filed_date DESC LIMIT ?",
                    (form, limit),
                )
            )

    # --- signals ---------------------------------------------------------
    def insert_signal(self, **kw: Any) -> int:
        kw.setdefault("metadata_json", json.dumps(kw.pop("metadata", {}) or {}))
        cols = ",".join(kw.keys())
        placeholders = ",".join(f":{k}" for k in kw.keys())
        with self.conn() as c:
            cur = c.execute(
                f"INSERT INTO signals ({cols}) VALUES ({placeholders})", kw
            )
            return cur.lastrowid or 0

    def signals_since(self, days: int = 7) -> list[sqlite3.Row]:
        with self.conn() as c:
            return list(
                c.execute(
                    """
                    SELECT * FROM signals
                    WHERE detected_at >= datetime('now', ?)
                    ORDER BY detected_at DESC
                    """,
                    (f"-{days} days",),
                )
            )

    # --- extractions -----------------------------------------------------
    def store_extraction(
        self,
        accession: str,
        schema_name: str,
        model: str,
        payload: dict[str, Any],
        tokens_in: int = 0,
        tokens_out: int = 0,
    ) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO extractions
                  (accession, schema_name, model, tokens_in, tokens_out, payload_json)
                VALUES (?,?,?,?,?,?)
                """,
                (accession, schema_name, model, tokens_in, tokens_out,
                 json.dumps(payload)),
            )

    def get_extraction(self, accession: str, schema_name: str) -> dict[str, Any] | None:
        with self.conn() as c:
            row = c.execute(
                "SELECT payload_json FROM extractions WHERE accession=? AND schema_name=?",
                (accession, schema_name),
            ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    # --- insider trades --------------------------------------------------
    def insert_insider_trade(self, row: dict[str, Any]) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT INTO insider_trades
                  (accession, cik, issuer_ticker, reporter_name, reporter_title,
                   transaction_code, transaction_date, shares, price, dollar_value,
                   post_holdings, is_officer, is_director, is_ten_percent)
                VALUES
                  (:accession, :cik, :issuer_ticker, :reporter_name, :reporter_title,
                   :transaction_code, :transaction_date, :shares, :price, :dollar_value,
                   :post_holdings, :is_officer, :is_director, :is_ten_percent)
                """,
                row,
            )

    def insider_clusters(
        self, days: int = 30, min_buyers: int = 3, min_total_usd: float = 250_000
    ) -> list[sqlite3.Row]:
        """Aggregate open-market buys by issuer over the window."""
        with self.conn() as c:
            return list(
                c.execute(
                    """
                    SELECT cik, issuer_ticker,
                           COUNT(DISTINCT reporter_name) AS buyers,
                           SUM(dollar_value) AS total_usd,
                           SUM(is_officer)   AS officer_buys,
                           SUM(is_director)  AS director_buys,
                           MIN(transaction_date) AS first_buy,
                           MAX(transaction_date) AS last_buy
                    FROM insider_trades
                    WHERE transaction_code='P'
                      AND transaction_date >= date('now', ?)
                    GROUP BY cik, issuer_ticker
                    HAVING buyers >= ? AND total_usd >= ?
                    ORDER BY total_usd DESC
                    """,
                    (f"-{days} days", min_buyers, min_total_usd),
                )
            )

    # --- supply-chain graph ---------------------------------------------
    def upsert_edge(self, row: dict[str, Any]) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT INTO supply_chain_edges
                  (src_cik, dst_cik, src_name, dst_name, relation,
                   confidence, first_seen, last_seen)
                VALUES
                  (:src_cik, :dst_cik, :src_name, :dst_name, :relation,
                   :confidence, :first_seen, :last_seen)
                ON CONFLICT(src_cik, dst_cik, relation) DO UPDATE SET
                  last_seen=excluded.last_seen,
                  confidence=MAX(supply_chain_edges.confidence, excluded.confidence)
                """,
                row,
            )

    # --- ranked ideas ---------------------------------------------------
    def write_rankings(self, run_date: str, rows: list[dict[str, Any]]) -> None:
        with self.conn() as c:
            c.execute("DELETE FROM ranked_ideas WHERE run_date=?", (run_date,))
            c.executemany(
                """
                INSERT INTO ranked_ideas
                  (run_date, ticker, cik, composite_score, rationale)
                VALUES (:run_date, :ticker, :cik, :composite_score, :rationale)
                """,
                [{"run_date": run_date, **r} for r in rows],
            )
