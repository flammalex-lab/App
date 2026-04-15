"""Alpha: event-driven + deep-value research engine.

High-level architecture:
    edgar/   — SEC EDGAR client (forms, filings, full-text search)
    signals/ — each investment strategy as a detection module
    llm/     — Claude-powered structured extraction
    store/   — SQLite persistence
    scoring/ — composite priority ranking
    digest/  — daily markdown report
    backtest/— walk-forward harness
"""

__version__ = "0.1.0"
