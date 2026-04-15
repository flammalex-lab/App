-- Alpha persistence schema. One SQLite file; everything is append-only where
-- possible so historical signals remain auditable.

CREATE TABLE IF NOT EXISTS filings (
    accession       TEXT PRIMARY KEY,
    cik             TEXT NOT NULL,
    company         TEXT NOT NULL,
    ticker          TEXT,
    form            TEXT NOT NULL,
    filed_date      DATE NOT NULL,
    primary_doc     TEXT,
    url             TEXT,
    fetched_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS filings_form_date ON filings(form, filed_date DESC);
CREATE INDEX IF NOT EXISTS filings_cik ON filings(cik);

CREATE TABLE IF NOT EXISTS companies (
    cik             TEXT PRIMARY KEY,
    ticker          TEXT,
    name            TEXT,
    sic             TEXT,
    sector          TEXT,
    exchange        TEXT,
    country         TEXT,
    market_cap_usd  REAL,
    last_updated    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS companies_ticker ON companies(ticker);

-- Each signal detection is one row. Signals are additive — multiple signals on
-- the same ticker compound in the scoring layer.
CREATE TABLE IF NOT EXISTS signals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_type     TEXT NOT NULL,
    ticker          TEXT,
    cik             TEXT,
    accession       TEXT,
    detected_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    catalyst_date   DATE,           -- expected catalyst (if known)
    confidence      REAL,           -- 0.0 - 1.0
    asymmetry       REAL,           -- expected upside / expected downside
    headline        TEXT,
    rationale       TEXT,           -- human-readable explanation
    metadata_json   TEXT            -- signal-specific structured payload
);
CREATE INDEX IF NOT EXISTS signals_type_date ON signals(signal_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS signals_ticker ON signals(ticker);

-- LLM extraction outputs. One row per (accession, extraction_schema).
CREATE TABLE IF NOT EXISTS extractions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    accession       TEXT NOT NULL,
    schema_name     TEXT NOT NULL,
    model           TEXT NOT NULL,
    extracted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tokens_in       INTEGER,
    tokens_out      INTEGER,
    payload_json    TEXT NOT NULL,
    UNIQUE(accession, schema_name)
);

-- Insider Form 4 events, normalized. The cluster detector queries this.
CREATE TABLE IF NOT EXISTS insider_trades (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    accession       TEXT,
    cik             TEXT,           -- issuer CIK
    issuer_ticker   TEXT,
    reporter_name   TEXT,
    reporter_title  TEXT,
    transaction_code TEXT,          -- P (purchase), S (sale), A (award), M (exercise)
    transaction_date DATE,
    shares          REAL,
    price           REAL,
    dollar_value    REAL,
    post_holdings   REAL,
    is_officer      INTEGER,
    is_director     INTEGER,
    is_ten_percent  INTEGER
);
CREATE INDEX IF NOT EXISTS it_issuer_date ON insider_trades(cik, transaction_date DESC);

-- Composite ranking per run, so we can review how yesterday's digest looked.
CREATE TABLE IF NOT EXISTS ranked_ideas (
    run_date        DATE NOT NULL,
    ticker          TEXT,
    cik             TEXT,
    composite_score REAL,
    rationale       TEXT,
    PRIMARY KEY(run_date, ticker)
);

-- Supply-chain edges harvested from 10-K risk-factor / customer-concentration
-- disclosures. (A) mentions (B) -> directed edge A->B.
CREATE TABLE IF NOT EXISTS supply_chain_edges (
    src_cik         TEXT,
    dst_cik         TEXT,
    src_name        TEXT,
    dst_name        TEXT,
    relation        TEXT,  -- 'customer' | 'supplier' | 'partner'
    confidence      REAL,
    first_seen      DATE,
    last_seen       DATE,
    PRIMARY KEY(src_cik, dst_cik, relation)
);

-- Positions ledger (optional; for portfolio tracking).
CREATE TABLE IF NOT EXISTS positions (
    ticker          TEXT PRIMARY KEY,
    cost_basis      REAL,
    shares          REAL,
    sleeve          TEXT,     -- core | special | leaps | lottery
    thesis          TEXT,
    entry_date      DATE,
    catalyst_date   DATE,
    stop_rule       TEXT
);
