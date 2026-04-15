"""Pydantic schemas that define the *output* of each LLM extraction.

Keeping the schema strict means:
  (a) we can validate + reject hallucinated / malformed outputs
  (b) downstream SQL queries can trust the shape
  (c) the prompt template can be generated from the schema (via JSON schema)
"""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SpinoffExtraction(BaseModel):
    newco_name: Optional[str] = None
    newco_ticker: Optional[str] = None
    parent_name: Optional[str] = None
    parent_ticker: Optional[str] = None
    distribution_date: Optional[date] = None
    record_date: Optional[date] = None
    spinoff_ratio: Optional[str] = None
    parent_market_cap_usd: Optional[float] = None
    newco_est_market_cap_usd: Optional[float] = None
    size_ratio_pct: Optional[float] = Field(
        default=None,
        description="newco_mcap / parent_mcap * 100",
    )
    newco_sector: Optional[str] = None
    parent_sector: Optional[str] = None
    management_moves_to_newco: list[str] = Field(default_factory=list)
    forced_selling_likely: bool = True
    insider_comp_tied_to_newco: Optional[bool] = None
    red_flags: list[str] = Field(default_factory=list)
    rationale: Optional[str] = None


class Activist13DExtraction(BaseModel):
    filer_name: Optional[str] = None
    filer_cik: Optional[str] = None
    target_name: Optional[str] = None
    target_ticker: Optional[str] = None
    percent_owned: Optional[float] = None
    shares_owned: Optional[int] = None
    purpose: Optional[str] = None
    escalation_terms: list[str] = Field(
        default_factory=list,
        description="e.g., 'board representation', 'strategic alternatives', "
                    "'sale process', 'oppose merger'",
    )
    is_amendment: bool = False


class Form4Trade(BaseModel):
    accession: Optional[str] = None
    cik: Optional[str] = None
    issuer_ticker: Optional[str] = None
    reporter_name: str
    reporter_title: Optional[str] = None
    transaction_code: Literal["P", "S", "A", "M", "F", "G", "D", "J", "K", "C", "V", "X"]
    transaction_date: date
    shares: float
    price: Optional[float] = None
    dollar_value: Optional[float] = None
    post_holdings: Optional[float] = None
    is_officer: int = 0
    is_director: int = 0
    is_ten_percent: int = 0


class Form4Extraction(BaseModel):
    trades: list[Form4Trade] = Field(default_factory=list)


class SupplyChainEdge(BaseModel):
    counterparty_name: str
    counterparty_ticker: Optional[str] = None
    counterparty_cik: Optional[str] = None
    relation: Literal["customer", "supplier", "partner"]
    revenue_pct: Optional[float] = None
    confidence: float = 0.7


class SupplyChainExtraction(BaseModel):
    edges: list[SupplyChainEdge] = Field(default_factory=list)


SCHEMAS = {
    "spinoff_v1": SpinoffExtraction,
    "activist_v1": Activist13DExtraction,
    "form4_v1": Form4Extraction,
    "supply_chain_v1": SupplyChainExtraction,
}
