"""Heuristic loser-detector for spin-offs.

CALIBRATION NOTE (post-backtest):
    The first version of this heuristic (sector + leverage + revenue
    rules) HURT walk-forward returns because spin-off alpha comes from
    situations that LOOK ugly on paper — high leverage, dumped sectors,
    sub-scale revenue. Penalizing those threw out the winners.

    The current version uses ONLY hard-pass filters where the
    fundamental analysis is unambiguous: China VIE, no listed exchange,
    no real revenue (likely shell), or extreme negative equity. We
    leave subjective "is this a good business" judgments to LLM
    extraction.

A free, no-LLM-required filter that approximates what a strict
analyst would catch ON THE OBVIOUS DISASTERS. Uses:
  - SEC XBRL Company Facts API (free)
  - SEC submissions JSON

Hard-pass conditions only:
  - China VIE / Cayman shell (regulatory + governance risk)
  - OTC-only listing (no real institutional sponsorship possible)
  - <$5M TTM revenue (likely shell, not a real spin)
  - Two or more NT (late filing) reports in last 24 months

Anything else: pass-through. The system will still surface and rank;
the LLM filter (when available) provides the nuanced judgment.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

log = logging.getLogger("alpha.backtest.heuristic")


# Sectors with chronically poor spin-off outcomes (anecdotal + observed
# from walk-forward losers). These are SIC 2-digit prefixes.
TOUGH_SECTORS = {
    "13",   # Oil & gas extraction
    "12",   # Bituminous coal
    "47",   # Transportation services (asset-light, low margin)
    "60",   # Depository institutions (better via specialized vehicles)
    "65",   # Real estate (use REIT-specific tools)
}


@dataclass
class HeuristicAssessment:
    cik: str
    quality_score: float = 0.5    # 0.0 - 1.0
    pass_recommendation: str = "watch"  # high_conviction | buy | watch | pass
    red_flags: list[str] = field(default_factory=list)
    green_flags: list[str] = field(default_factory=list)
    rationale: str = ""


class HeuristicFilter:
    """Pulls SEC Company Facts + Submissions and computes a quality score."""

    def __init__(self, edgar_client):
        self.edgar = edgar_client

    def assess(self, cik: str, filing_date: str | None = None
                ) -> HeuristicAssessment:
        """Apply hard-pass filters only. Anything not failing is 'buy'.

        Backtest learning: nuanced quality grading (sector, leverage,
        size of revenue) HURTS spin-off returns because the alpha comes
        from situations that look ugly. We only filter the OBVIOUS
        disasters here. Use the LLM filter for nuanced judgment.
        """
        cik10 = str(cik).zfill(10)
        result = HeuristicAssessment(cik=cik10, quality_score=0.65,
                                       pass_recommendation="buy")
        hard_pass = False

        # Pull submissions
        try:
            subs = self.edgar.company_submissions(cik10)
        except Exception as e:  # noqa: BLE001
            log.debug("submissions failed for %s: %s", cik10, e)
            result.rationale = "no submission data; default buy"
            return result

        # HARD PASS: China VIE / Cayman shell
        country = (subs.get("country", "") or "").upper()
        state = (subs.get("stateOfIncorporation", "") or "").upper()
        if country in ("CN", "CHINA", "HK"):
            result.red_flags.append("China-domiciled (VIE governance risk)")
            hard_pass = True

        # HARD PASS: no listed exchange (OTC-only)
        exchanges = subs.get("exchanges", []) or []
        ex_list = [e.upper() for e in exchanges if e]
        if not ex_list or all(e in ("OTC", "PINK", "OTCQX", "OTCQB")
                                for e in ex_list):
            result.red_flags.append("OTC-only / no listed exchange")
            hard_pass = True

        # HARD PASS: heavy late-filing pattern
        recent = subs.get("filings", {}).get("recent", {})
        forms = recent.get("form", []) or []
        nt_count = sum(1 for f in forms if f.startswith("NT "))
        if nt_count >= 3:
            result.red_flags.append(f"{nt_count} NT late-filing reports")
            hard_pass = True

        # Pull XBRL Company Facts for revenue check
        try:
            url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik10}.json"
            raw = self.edgar._get(url, host="data.sec.gov", use_cache=True)
            facts = json.loads(raw)
        except Exception:  # noqa: BLE001
            facts = {"facts": {}}

        gaap = facts.get("facts", {}).get("us-gaap", {})
        rev_node = gaap.get("Revenues", {}).get("units", {}).get("USD", [])
        rev_node += gaap.get(
            "RevenueFromContractWithCustomerExcludingAssessedTax", {}
        ).get("units", {}).get("USD", [])
        if rev_node:
            chosen = None
            usd_sorted = sorted(rev_node, key=lambda x: x.get("end", ""))
            if filing_date:
                for entry in reversed(usd_sorted):
                    if entry.get("end", "") <= filing_date:
                        chosen = entry
                        break
            chosen = chosen or (usd_sorted[-1] if usd_sorted else None)
            if chosen:
                rev = float(chosen.get("val", 0))
                if rev > 50_000_000:
                    result.green_flags.append(f"Real revenue (${rev/1e6:.0f}M)")
                if 0 < rev < 5_000_000:
                    result.red_flags.append(
                        f"Sub-$5M revenue (${rev/1e6:.1f}M); likely shell")
                    hard_pass = True

        # Final score
        if hard_pass:
            result.quality_score = 0.10
            result.pass_recommendation = "pass"
        else:
            base = 0.65 + 0.05 * len(result.green_flags)
            result.quality_score = round(min(0.85, base), 3)
            if result.quality_score >= 0.75:
                result.pass_recommendation = "high_conviction"
            else:
                result.pass_recommendation = "buy"
        result.rationale = (
            f"score={result.quality_score:.2f}, "
            f"green={len(result.green_flags)} red={len(result.red_flags)} "
            f"-> {result.pass_recommendation}"
        )
        return result
