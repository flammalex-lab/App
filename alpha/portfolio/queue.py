"""Deploy queue: candidates waiting for a portfolio slot to open.

Operating model:
  1. Detector finds new Form 10s daily, produces SpinoffCandidates.
  2. Candidates with tradeable=True + heuristic.pass_filter=True are
     added to the queue with a ready_date (filing + 21 trading days).
  3. When the ledger has an open slot (one of N positions closed), the
     queue manager picks the oldest ready candidate.
  4. Live/paper trader executes the deployment at ready_date's close.

Deduplication: a candidate already in the queue or already held is
skipped. Candidates become stale after 90 days (probably spin was
cancelled or we missed the window).
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Iterator

from alpha.config import DATA_DIR
from alpha.spinoffs.detector import SpinoffCandidate


QUEUE_SCHEMA = """
CREATE TABLE IF NOT EXISTS deploy_queue (
    accession         TEXT PRIMARY KEY,
    cik               TEXT NOT NULL,
    company           TEXT NOT NULL,
    ticker            TEXT,
    filed_date        DATE NOT NULL,
    ready_date        DATE NOT NULL,
    size_bucket       TEXT,
    newco_mcap_usd    REAL,
    tradeable         INTEGER NOT NULL,
    heuristic_flags   TEXT,
    metadata_json     TEXT,
    added_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deployed_id       INTEGER,                 -- ledger_positions.id when deployed
    stale_marked      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS queue_ready ON deploy_queue(ready_date)
    WHERE deployed_id IS NULL AND stale_marked = 0;
"""


class DeployQueue:
    STALE_AFTER_DAYS = 90

    def __init__(self, path: Path | None = None):
        self.path = path or (DATA_DIR / "alpha.sqlite")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self) -> None:
        with self.conn() as c:
            c.executescript(QUEUE_SCHEMA)

    @contextmanager
    def conn(self) -> Iterator[sqlite3.Connection]:
        c = sqlite3.connect(self.path, detect_types=sqlite3.PARSE_DECLTYPES)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def upsert(self, candidate: SpinoffCandidate) -> bool:
        """Insert or update a candidate. Returns True if newly added."""
        with self.conn() as c:
            cur = c.execute(
                """
                INSERT OR IGNORE INTO deploy_queue
                  (accession, cik, company, ticker, filed_date, ready_date,
                   size_bucket, newco_mcap_usd, tradeable, heuristic_flags,
                   metadata_json)
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    candidate.accession, candidate.cik, candidate.company,
                    candidate.ticker, candidate.filed_date.isoformat(),
                    candidate.ready_date.isoformat(), candidate.size_bucket,
                    candidate.newco_mcap_usd, 1 if candidate.tradeable else 0,
                    json.dumps({
                        "red_flags": candidate.heuristic.red_flags,
                        "green_flags": candidate.heuristic.green_flags,
                    }),
                    json.dumps({"primary_doc_url": candidate.primary_doc_url}),
                ),
            )
            return cur.rowcount > 0

    def ready_candidates(
        self, *, today: date | None = None, only_tradeable: bool = True
    ) -> list[sqlite3.Row]:
        """Candidates whose ready_date has arrived and haven't been deployed."""
        today = today or date.today()
        with self.conn() as c:
            where = ["ready_date <= ?", "deployed_id IS NULL",
                     "stale_marked = 0"]
            params: list = [today.isoformat()]
            if only_tradeable:
                where.append("tradeable = 1")
            sql = (
                "SELECT * FROM deploy_queue WHERE "
                + " AND ".join(where)
                + " ORDER BY ready_date ASC"
            )
            return list(c.execute(sql, params))

    def mark_deployed(self, accession: str, position_id: int) -> None:
        with self.conn() as c:
            c.execute(
                "UPDATE deploy_queue SET deployed_id=? WHERE accession=?",
                (position_id, accession),
            )

    def mark_stale(self, today: date | None = None) -> int:
        """Flag un-deployed candidates older than STALE_AFTER_DAYS as stale."""
        today = today or date.today()
        cutoff = today - timedelta(days=self.STALE_AFTER_DAYS)
        with self.conn() as c:
            cur = c.execute(
                "UPDATE deploy_queue SET stale_marked=1 "
                "WHERE deployed_id IS NULL AND stale_marked=0 "
                "AND ready_date < ?",
                (cutoff.isoformat(),),
            )
            return cur.rowcount

    def all_active(self) -> list[sqlite3.Row]:
        with self.conn() as c:
            return list(c.execute(
                "SELECT * FROM deploy_queue "
                "WHERE deployed_id IS NULL AND stale_marked=0 "
                "ORDER BY ready_date ASC"
            ))
