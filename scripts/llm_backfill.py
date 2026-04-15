#!/usr/bin/env python3
"""LLM backfill: score every historical Form 10 with Claude.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python scripts/llm_backfill.py --csv data/backtest/.../spinoff_events.csv \\
                                   --budget-usd 25 \\
                                   --model claude-sonnet-4-6

Features:
- Caches every LLM result in SQLite (extractions table) keyed by accession,
  so subsequent runs are free.
- Estimates cost before each call using a token-counting heuristic.
- Enforces a hard budget ceiling. When we hit it, we stop and commit what
  we have. Safe to rerun later — it picks up where it left off.
- Produces an enriched CSV with the LLM recommendation / score / flags
  that the chronological simulator can consume.
- Dry-run mode prints the plan without spending anything.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import time
from pathlib import Path

import pandas as pd

from alpha.edgar import EdgarClient
from alpha.edgar.client import Filing
from alpha.llm.spinoff_filter import (
    SPINOFF_FILTER_SYSTEM, SpinoffQualityAssessment,
    score_filing_with_llm,
)
from alpha.store import Store


# Rough cost model for Claude Sonnet 4.6 (as of 2026):
#   Input: $3/M tokens. Output: $15/M tokens.
# Spin-off Form 10s average ~30k input tokens (truncated), ~1k output.
# Budget per call: ~$0.10. Caching the system prompt saves ~50% on input.
COST_PER_CALL_USD = 0.10


def _html_to_text(raw: bytes) -> str:
    """Very small HTML stripper (we don't need perfect fidelity)."""
    import re
    text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _load_anthropic():
    try:
        from anthropic import Anthropic
    except ImportError:
        raise SystemExit("anthropic SDK not installed. `pip install anthropic`.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY not set.")
    return Anthropic()


def _find_accession_and_doc(
    edgar: EdgarClient, cik: str, filed_date: str,
    target_forms: tuple[str, ...] = ("10-12B", "10-12B/A", "10-12G", "10-12G/A"),
) -> tuple[str | None, str | None]:
    """Look up (accession, primary_doc_url) from cik + filing date."""
    try:
        subs = edgar.company_submissions(cik)
    except Exception:  # noqa: BLE001
        return None, None
    recent = subs.get("filings", {}).get("recent", {})
    accnos = recent.get("accessionNumber", []) or []
    forms = recent.get("form", []) or []
    dates = recent.get("filingDate", []) or []
    primaries = recent.get("primaryDocument", []) or []
    # Exact-date match first
    for i, form in enumerate(forms):
        if form in target_forms and i < len(dates) and dates[i] == filed_date:
            acc = accnos[i]
            primary = primaries[i] if i < len(primaries) else ""
            acc_nodash = acc.replace("-", "")
            cik_int = int(cik)
            url = (f"https://www.sec.gov/Archives/edgar/data/"
                   f"{cik_int}/{acc_nodash}/{primary}")
            return acc, url
    # Fuzzy match: within +/- 3 days
    from datetime import datetime, timedelta
    try:
        target = datetime.strptime(filed_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None, None
    best = None
    best_delta = None
    for i, form in enumerate(forms):
        if form not in target_forms:
            continue
        if i >= len(dates):
            continue
        try:
            d = datetime.strptime(dates[i], "%Y-%m-%d").date()
        except ValueError:
            continue
        delta = abs((d - target).days)
        if delta <= 3 and (best_delta is None or delta < best_delta):
            best = i
            best_delta = delta
    if best is not None:
        acc = accnos[best]
        primary = primaries[best] if best < len(primaries) else ""
        acc_nodash = acc.replace("-", "")
        cik_int = int(cik)
        url = (f"https://www.sec.gov/Archives/edgar/data/"
               f"{cik_int}/{acc_nodash}/{primary}")
        return acc, url
    return None, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path,
                    default=Path("data/backtest/walk_forward_2015-01-01_2024-12-31/"
                                  "spinoff_events_with_heuristic.csv"),
                    help="Input events CSV (columns cik, filed_date required; "
                         "any other columns are preserved in output). Defaults "
                         "to the heuristic-enriched CSV so size_bucket + "
                         "heuristic_recommendation are preserved in output.")
    ap.add_argument("--out", type=Path,
                    help="Output enriched CSV. Defaults to <csv>_with_llm.csv.")
    ap.add_argument("--budget-usd", type=float, default=25.0,
                    help="Hard cost ceiling. Script stops when hit.")
    ap.add_argument("--model", default=os.environ.get("ALPHA_MODEL_DEEP",
                                                        "claude-sonnet-4-6"))
    ap.add_argument("--dry-run", action="store_true",
                    help="Print plan and stop. No API calls made.")
    ap.add_argument("--limit", type=int, default=None,
                    help="Max filings to process (for testing).")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%H:%M:%S")

    df = pd.read_csv(args.csv)

    # Only keep events with complete metadata
    df = df.dropna(subset=["cik", "filed_date"]).copy()
    df["cik"] = df["cik"].astype(str).str.zfill(10)
    if args.limit:
        df = df.head(args.limit)

    store = Store()
    edgar = EdgarClient()

    # Resolve accession number for each event (from cik + filed_date)
    logging.info("Resolving accessions for %d events...", len(df))
    accessions: list[str | None] = []
    doc_urls: list[str | None] = []
    for _, row in df.iterrows():
        acc, url = _find_accession_and_doc(edgar, row["cik"], row["filed_date"])
        accessions.append(acc)
        doc_urls.append(url)
    df["accession"] = accessions
    df["primary_doc_url"] = doc_urls

    resolved = int(df["accession"].notna().sum())
    logging.info("Resolved %d/%d accessions.", resolved, len(df))

    # Pass 1: classify each event as cached / needs-call
    need_call: list[dict] = []
    cached_count = 0
    unresolved = 0
    for _, row in df.iterrows():
        acc = row["accession"]
        if not acc:
            unresolved += 1
            continue
        existing = store.get_extraction(acc, "spinoff_filter_v1")
        if existing:
            cached_count += 1
            continue
        need_call.append(row.to_dict())

    est_cost = len(need_call) * COST_PER_CALL_USD
    logging.info(
        "Events total=%d | cached=%d | need LLM call=%d | est cost=$%.2f "
        "(budget=$%.2f)",
        len(df), cached_count, len(need_call), est_cost, args.budget_usd,
    )

    if args.dry_run:
        logging.info("Dry-run mode: not calling LLM. Done.")
        _write_enriched_csv(df, store, args)
        return 0

    edgar = EdgarClient()
    client = _load_anthropic()

    calls_allowed = min(len(need_call),
                         int(args.budget_usd / COST_PER_CALL_USD))
    logging.info("Will process up to %d filings this run.", calls_allowed)

    spent = 0.0
    n_ok = 0
    n_fail = 0
    for i, row in enumerate(need_call[:calls_allowed], 1):
        acc = row["accession"]
        cik = row["cik"]
        filed_date = row.get("filed_date", "")
        logging.info("[%d/%d] cik=%s acc=%s filed=%s",
                     i, calls_allowed, cik, acc, filed_date)
        doc_url = _get_primary_doc_url(edgar, cik, acc)
        if not doc_url:
            logging.warning("  no primary doc URL")
            n_fail += 1
            continue
        try:
            raw = edgar._get(doc_url, host="www.sec.gov", use_cache=True)
        except Exception as e:  # noqa: BLE001
            logging.warning("  doc fetch failed: %s", e)
            n_fail += 1
            continue
        text = _html_to_text(raw)
        if len(text) < 2000:
            logging.warning("  doc suspiciously short (%d chars)", len(text))
            n_fail += 1
            continue

        assessment = score_filing_with_llm(client, args.model, text)
        if assessment is None:
            logging.warning("  LLM call failed / unparseable")
            n_fail += 1
            continue

        # Cache the result
        store.store_extraction(
            accession=acc,
            schema_name="spinoff_filter_v1",
            model=args.model,
            payload=json.loads(assessment.model_dump_json()),
        )
        spent += COST_PER_CALL_USD
        n_ok += 1
        logging.info("  -> %s (score=%.2f) spent=$%.2f",
                     assessment.recommendation, assessment.quality_score, spent)

        if spent + COST_PER_CALL_USD > args.budget_usd:
            logging.info("Budget exhausted; stopping.")
            break
        # Gentle SEC rate limit spacing
        time.sleep(0.2)

    logging.info("Done. ok=%d fail=%d spent=$%.2f", n_ok, n_fail, spent)
    _write_enriched_csv(df, store, args)
    return 0


def _write_enriched_csv(df: pd.DataFrame, store: Store, args) -> None:
    # Consistent output name: spinoff_events_with_llm.csv (not chained suffixes)
    if args.out:
        out = args.out
    else:
        out_name = args.csv.stem
        for tag in ("_with_heuristic", "_with_size"):
            out_name = out_name.replace(tag, "")
        out = args.csv.with_name(out_name + "_with_llm.csv")
    rows = []
    for _, row in df.iterrows():
        acc = row["accession"]
        ex = store.get_extraction(acc, "spinoff_filter_v1")
        if ex is None:
            rec = {
                "llm_scored": False,
                "llm_recommendation": None,
                "llm_quality_score": None,
                "llm_size_ratio_pct": None,
                "llm_red_flag_count": None,
                "llm_going_concern": None,
            }
        else:
            rec = {
                "llm_scored": True,
                "llm_recommendation": ex.get("recommendation"),
                "llm_quality_score": ex.get("quality_score"),
                "llm_size_ratio_pct": ex.get("size_ratio_pct"),
                "llm_red_flag_count": len(ex.get("red_flags") or []),
                "llm_going_concern": ex.get("going_concern_warning"),
            }
        rows.append({**row.to_dict(), **rec})
    pd.DataFrame(rows).to_csv(out, index=False)
    logging.info("Wrote %s", out)


if __name__ == "__main__":
    raise SystemExit(main())
