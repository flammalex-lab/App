"""LLM as analyst, not gatekeeper.

Backtest lesson: using the LLM to filter buy/pass hurt CAGR (45% -> 23%).
The LLM is too precise — it filters out "ugly because forced-seller"
situations that are actually the highest-alpha setups (GRAIL, Chemours).

Reposition: use the LLM to SUPPORT human decision-making, not replace it.
Two tasks:
  1. `write_thesis(filing)` -> 3-sentence investment thesis + key risks
  2. `extract_red_flags(filing)` -> narrow list of DIRE flags only
     (going concern, fraud patterns, restatements). NOT business quality
     judgment.

These outputs inform the user's due diligence, not the deploy decision.
Deploy is governed by the validated heuristic + size filter.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from pydantic import BaseModel, Field

log = logging.getLogger("alpha.llm.thesis")


THESIS_SYSTEM = """You are a special-situations analyst writing concise,
honest investment theses for spin-off opportunities. You read Form 10 /
Form 10-12B filings and output structured JSON. You never pretend to
know things not in the document.
"""


class InvestmentThesis(BaseModel):
    newco_name: Optional[str] = None
    newco_ticker: Optional[str] = None
    parent_name: Optional[str] = None
    one_line_summary: str = Field(..., max_length=250)
    thesis_bullets: list[str] = Field(
        ..., description="3-5 bullets explaining the investment case"
    )
    key_risks: list[str] = Field(
        ..., description="2-4 risks a buyer must accept"
    )
    catalysts: list[str] = Field(
        default_factory=list,
        description="Expected events that could unlock value"
    )
    forced_selling_rationale: Optional[str] = Field(
        None,
        description="Why parent-company holders are likely to dump "
                    "regardless of newco quality"
    )


THESIS_USER_TEMPLATE = """
Read this Form 10 / Form 10-12B and produce a structured investment
thesis in JSON.

Include:
- 1-line summary of what newco is.
- 3-5 thesis bullets (why this is an asymmetric opportunity).
- 2-4 key risks that a buyer must accept.
- Any expected catalysts (distribution, index inclusion, tender, etc.).
- Rationale for why parent-company holders will likely dump newco
  (forced selling is the key Greenblatt-style alpha driver).

Do NOT make a buy/pass recommendation. Your job is to write the brief;
the human will decide whether to buy.

Schema:
{schema}

=== DOCUMENT ===
{doc}
=== END DOCUMENT ===

Respond ONLY with valid JSON matching the schema.
"""


class DireRedFlags(BaseModel):
    going_concern: bool = False
    recent_restatement: bool = False
    auditor_change_last_12m: bool = False
    sec_investigation_disclosed: bool = False
    material_weakness_icfr: bool = False
    fraud_related_litigation: bool = False
    details: list[str] = Field(default_factory=list)


RED_FLAGS_USER_TEMPLATE = """
Read this Form 10 and identify ONLY the most severe "avoid this
regardless" red flags. Do NOT assess business quality or size.

Only report:
- Going concern qualification in audit opinion
- Financial restatement in last 24 months
- Auditor change in last 12 months (with details)
- Disclosed SEC investigation or subpoena
- Material weakness in ICFR
- Fraud-related litigation naming the issuer

Return JSON matching schema. Set all booleans to False unless the
document explicitly states the issue. 'Details' should list 1-line
evidence strings.

Schema:
{schema}

=== DOCUMENT ===
{doc}
=== END DOCUMENT ===

Respond ONLY with valid JSON.
"""


def _extract_json(raw: str) -> dict[str, Any] | None:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def write_thesis(client: Any, model: str, filing_text: str
                  ) -> InvestmentThesis | None:
    """Call Claude to produce a structured investment thesis."""
    schema_json = json.dumps(InvestmentThesis.model_json_schema(), indent=2)
    prompt = THESIS_USER_TEMPLATE.format(
        schema=schema_json, doc=filing_text[:120_000],
    )
    try:
        resp = client.messages.create(
            model=model, max_tokens=3000,
            system=[{"type": "text", "text": THESIS_SYSTEM,
                      "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:  # noqa: BLE001
        log.warning("thesis LLM call failed: %s", e)
        return None
    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    data = _extract_json(text)
    if not data:
        return None
    try:
        return InvestmentThesis.model_validate(data)
    except Exception as e:  # noqa: BLE001
        log.warning("thesis validation failed: %s", e)
        return None


def extract_red_flags(client: Any, model: str, filing_text: str
                       ) -> DireRedFlags | None:
    """Call Claude to identify dire red flags only."""
    schema_json = json.dumps(DireRedFlags.model_json_schema(), indent=2)
    prompt = RED_FLAGS_USER_TEMPLATE.format(
        schema=schema_json, doc=filing_text[:120_000],
    )
    try:
        resp = client.messages.create(
            model=model, max_tokens=1500,
            system=[{"type": "text", "text": THESIS_SYSTEM,
                      "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:  # noqa: BLE001
        log.warning("red-flags LLM call failed: %s", e)
        return None
    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    data = _extract_json(text)
    if not data:
        return None
    try:
        return DireRedFlags.model_validate(data)
    except Exception as e:  # noqa: BLE001
        log.warning("red-flags validation failed: %s", e)
        return None
