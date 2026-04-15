"""LLM-based spin-off quality filter.

For each Form 10 filing, calls Claude to extract a structured quality
assessment. The output is a "buy / watch / pass" recommendation plus
a score (0-1) and structured red/green flags.

This is the layer that should improve hit rate from ~52% (size-filter only)
to ~70%+ by catching:
  - Balance sheet disasters (high debt, pension dumping, related-party deals)
  - Management red flags (comp NOT aligned, key execs leaving)
  - Going-concern qualifications
  - Sector mismatches that DON'T cause forced selling
  - Aggressive accounting (capitalized R&D, off-balance-sheet SPVs)

Cost: ~$0.05-0.10 per filing with Sonnet (cheap given the value).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Optional

from pydantic import BaseModel, Field


SPINOFF_FILTER_SYSTEM = """You are a senior special-situations analyst with
20 years of experience in spin-off investing. You read Form 10 / Form 10-12B
filings and extract structured quality signals to support buy/pass decisions.

You are STRICT and SKEPTICAL. The base rate for spin-offs that lose money
in their first 18 months is ~40%. Your job is to identify which Form 10s
are likely to be in the losing 40%.

You return ONLY valid JSON matching the requested schema. No prose."""


class Recommendation(StrEnum):
    HIGH_CONVICTION = "high_conviction"
    BUY = "buy"
    WATCH = "watch"
    PASS = "pass"


class SpinoffQualityAssessment(BaseModel):
    # Identification
    newco_name: Optional[str] = None
    newco_ticker: Optional[str] = None
    parent_name: Optional[str] = None

    # Size & forced-selling setup
    parent_market_cap_usd: Optional[float] = None
    newco_est_market_cap_usd: Optional[float] = None
    size_ratio_pct: Optional[float] = Field(
        default=None, description="newco / parent market cap, as percent"
    )
    different_sector: Optional[bool] = None
    forced_selling_likely: bool = True

    # Quality signals
    debt_to_assets: Optional[float] = None
    has_meaningful_revenue: Optional[bool] = None
    fcf_positive_3y: Optional[bool] = None
    going_concern_warning: bool = False
    auditor_change_recent: bool = False
    related_party_transactions_material: bool = False
    pension_obligations_transferred: bool = False
    legal_contingencies_material: bool = False

    # Management alignment
    ceo_or_cfo_moving_to_newco: bool = False
    insider_comp_tied_to_newco: Optional[bool] = None
    significant_insider_ownership_pct: Optional[float] = None

    # Sector/business
    sector: Optional[str] = None
    competitive_position_strong: Optional[bool] = None

    # Red and green flags (lists)
    red_flags: list[str] = Field(default_factory=list)
    green_flags: list[str] = Field(default_factory=list)

    # Final scoring
    quality_score: float = Field(
        ..., description="0.0 = certain loser, 1.0 = best-case Greenblatt setup"
    )
    recommendation: Recommendation
    rationale: str = Field(..., description="<=200 char summary of the call")


SPINOFF_FILTER_PROMPT = """
You are reading a Form 10 / Form 10-12B (spin-off registration statement).

Extract the following from the document and apply your analyst judgment.

KEY THINGS TO CHECK:

1. SIZE RATIO: Parent market cap >> newco market cap = forced-selling alpha.
   Size ratio < 15%: HIGH GREEN. 15-30%: neutral. >30%: low/no forced selling.

2. BALANCE SHEET HEALTH:
   - Debt / total assets > 70% = RED FLAG (parent dumping a debt-burdened entity)
   - Negative book value = RED FLAG
   - Negative trailing 3-yr FCF = RED FLAG
   - "Going concern" qualification = HARD PASS

3. MANAGEMENT ALIGNMENT:
   - CEO/CFO of parent moving to newco = GREEN (skin in the game)
   - Equity comp grants timed to spin = GREEN
   - Key execs explicitly NOT joining newco = RED

4. RELATED-PARTY / DUMPING:
   - Material ongoing related-party transactions w/ parent = RED
   - Pension obligations transferred to newco = RED
   - Newco bears legal contingencies parent created = RED

5. ACCOUNTING:
   - Recent auditor change = RED FLAG
   - Heavy capitalized R&D / aggressive revenue recognition = RED
   - Restated financials in last 24 months = HARD PASS

6. BUSINESS QUALITY:
   - Real meaningful TTM revenue (>$50M) = GREEN
   - Positive operating margin = GREEN
   - Fragmented / niche market position = mildly GREEN
   - Sole supplier or dominant customer = RED

7. CHINA VIE / FOREIGN STRUCTURE: HARD PASS regardless of other factors.

DECISION RULES:

- recommendation = "high_conviction" only if: size ratio < 15%, no red flags,
  >=2 green flags, healthy balance sheet, mgmt aligned.
- recommendation = "buy" if: size ratio < 30%, no major red flags, mostly clean.
- recommendation = "watch" if: interesting but ambiguous; needs more research.
- recommendation = "pass" if: ANY hard-pass condition, or 3+ red flags.

Score 0.0-1.0:
  0.0-0.2 = certain loser; do not buy
  0.2-0.4 = unattractive
  0.4-0.6 = ambiguous; needs more diligence
  0.6-0.8 = good setup; a buy
  0.8-1.0 = textbook Greenblatt; size aggressively

Return JSON matching the SpinoffQualityAssessment schema below.
"""


def build_filter_prompt(filing_text: str, schema_json: dict[str, Any]) -> str:
    return (
        SPINOFF_FILTER_PROMPT
        + "\n\nJSON schema:\n"
        + json.dumps(schema_json, indent=2)
        + "\n\n=== DOCUMENT START ===\n"
        + filing_text[:120_000]
        + "\n=== DOCUMENT END ===\n\n"
        + "Respond with ONLY valid JSON. No prose."
    )


def score_filing_with_llm(
    client: Any, model: str, filing_text: str
) -> Optional[SpinoffQualityAssessment]:
    """One-shot: send filing text to Claude, return parsed assessment.

    `client` is an Anthropic client. `model` is e.g. 'claude-sonnet-4-6'.
    Returns None if the call fails or the response can't be parsed.
    """
    schema = SpinoffQualityAssessment.model_json_schema()
    prompt = build_filter_prompt(filing_text, schema)
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=4000,
            system=[{"type": "text", "text": SPINOFF_FILTER_SYSTEM,
                      "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:  # noqa: BLE001
        return None

    raw = "".join(block.text for block in resp.content
                   if hasattr(block, "text")).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    try:
        return SpinoffQualityAssessment.model_validate(data)
    except Exception:  # noqa: BLE001
        return None
