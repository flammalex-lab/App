"""Prompt templates. Keep them small, explicit, and schema-constrained."""
from __future__ import annotations

import json
from typing import Any

from alpha.llm.schemas import SCHEMAS


SYSTEM_PROMPT = """You are a senior equity research analyst specializing in
event-driven and deep-value situations. You read SEC filings and extract
structured facts. You never speculate; if a fact is not in the document,
return null. You never output anything outside the requested JSON.
"""


PROMPTS: dict[str, str] = {
    "spinoff_v1": """
You are reading a Form 10 (spin-off registration) or Form S-1 (carve-out).

Extract:
- Parent company and newco (spun-off entity) names/tickers.
- Expected distribution date and record date if disclosed.
- Parent and newco market caps (use disclosed figures, or estimate newco
  from pro-forma financials + comparable trading multiples if clearly
  derivable).
- Size ratio (newco / parent, in %).
- Sectors of parent and newco.
- Named executives migrating from parent to newco.
- Whether management compensation is tied to newco equity.
- Any red flags (heavy debt at newco, pension liabilities transferred,
  unusual dilution, non-competes protecting parent).
- A 2-sentence rationale explaining why (or why not) this looks like a
  Greenblatt-style forced-selling opportunity.

Return JSON matching the 'spinoff_v1' schema below:
""",

    "activist_v1": """
You are reading an SC 13D or SC 13D/A.

Extract:
- Filer name and CIK (Item 2).
- Target company name and ticker (subject of the filing).
- Percent owned and share count (Item 5).
- Purpose of transaction (Item 4) — paraphrase briefly (<=300 chars).
- Any escalation signals: "nominate directors", "board representation",
  "strategic alternatives", "sale process", "oppose merger", "reject offer".
- Whether this is an amendment (Y/N).

Return JSON matching the 'activist_v1' schema.
""",

    "form4_v1": """
You are reading a Form 4 (insider transaction). Parse the XML/HTML into
one or more Trade records. Focus on open-market transactions (Code P or S).

For each transaction, extract:
- Reporter name and title.
- Transaction code (single letter).
- Transaction date.
- Shares and price.
- Post-transaction holdings.
- Officer / director / 10% owner flags.
- Compute dollar_value = shares * price.

Return JSON matching the 'form4_v1' schema.
""",

    "supply_chain_v1": """
You are reading a 10-K. Extract customer/supplier relationships from:
- Risk factors (particularly "customer concentration")
- MD&A segment discussions
- Note on "major customers"

For each named counterparty, return:
- Their name and ticker/CIK if identifiable.
- Whether they are a 'customer' or 'supplier' of the filer.
- Percent of revenue if disclosed (e.g., "accounted for 14% of total revenue").
- Confidence 0-1 (high for explicit ASC 280 disclosures, lower for narrative
  mentions).

Return JSON matching the 'supply_chain_v1' schema.
""",
}


def build_user_prompt(schema_name: str, document_text: str) -> str:
    schema = SCHEMAS[schema_name]
    schema_json = json.dumps(schema.model_json_schema(), indent=2)
    return (
        PROMPTS[schema_name].strip()
        + "\n\nJSON schema:\n"
        + schema_json
        + "\n\n=== DOCUMENT START ===\n"
        + document_text[:120_000]   # cap at ~120k chars for Claude context safety
        + "\n=== DOCUMENT END ===\n\n"
        + "Respond with ONLY valid JSON matching the schema. No prose."
    )
