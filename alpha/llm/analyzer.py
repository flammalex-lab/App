"""Claude-powered structured extractor.

Design:
- Two-tier model routing:
    * 'fast'  = Haiku  (form 4 parsing, boilerplate extraction)
    * 'deep'  = Sonnet (Form 10 analysis, 10-K supply-chain extraction)
- Prompt caching on the system prompt reduces cost on repeat calls.
- Results are validated against pydantic schemas; invalid JSON -> None.
- All extractions are stored in the DB (keyed by accession + schema name)
  so subsequent runs are idempotent.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from alpha.edgar.client import Filing
from alpha.llm.prompts import SYSTEM_PROMPT, build_user_prompt
from alpha.llm.schemas import SCHEMAS
from alpha.store import Store

log = logging.getLogger("alpha.llm")


def _strip_html(raw: bytes) -> str:
    """Cheap HTML stripper. For production, swap to selectolax / lxml text()."""
    try:
        text = raw.decode("utf-8", errors="ignore")
    except Exception:  # noqa: BLE001
        return ""
    # Remove scripts/styles/tags
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class LLMAnalyzer:
    def __init__(self, store: Store, client: Any | None = None):
        self.store = store
        self._client = client or self._default_client()
        self.model_fast = os.getenv("ALPHA_MODEL_FAST",
                                     "claude-haiku-4-5-20251001")
        self.model_deep = os.getenv("ALPHA_MODEL_DEEP", "claude-sonnet-4-6")

    @staticmethod
    def _default_client() -> Any:
        """Lazy import so the rest of the system works without the SDK installed."""
        try:
            from anthropic import Anthropic
        except ImportError:
            log.warning(
                "anthropic SDK not installed — LLM calls will be stubbed. "
                "Install with `pip install anthropic`."
            )
            return None
        if not os.getenv("ANTHROPIC_API_KEY"):
            log.warning("ANTHROPIC_API_KEY not set — LLM disabled.")
            return None
        return Anthropic()

    # ------------------------------------------------------------------
    # Core extraction
    # ------------------------------------------------------------------
    def _extract(
        self,
        filing: Filing,
        schema_name: str,
        doc_bytes: bytes,
        *,
        deep: bool = False,
    ) -> dict[str, Any] | None:
        if self._client is None:
            return None
        cached = self.store.get_extraction(filing.accession, schema_name)
        if cached is not None:
            return cached

        text = _strip_html(doc_bytes)
        prompt = build_user_prompt(schema_name, text)
        model = self.model_deep if deep else self.model_fast

        try:
            # Prompt caching on the system prompt (anthropic-beta header via SDK).
            response = self._client.messages.create(
                model=model,
                max_tokens=4000,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:  # noqa: BLE001
            log.exception("LLM call failed: %s", e)
            return None

        raw = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )
        data = self._parse_json(raw)
        if data is None:
            log.warning("LLM returned invalid JSON for %s / %s",
                        filing.accession, schema_name)
            return None

        # Validate against the schema.
        schema_cls = SCHEMAS.get(schema_name)
        if schema_cls is not None:
            try:
                data = schema_cls.model_validate(data).model_dump(mode="json")
            except Exception as e:  # noqa: BLE001
                log.warning("schema validation failed for %s: %s",
                            schema_name, e)
                return None

        usage = getattr(response, "usage", None)
        self.store.store_extraction(
            accession=filing.accession,
            schema_name=schema_name,
            model=model,
            payload=data,
            tokens_in=getattr(usage, "input_tokens", 0) or 0,
            tokens_out=getattr(usage, "output_tokens", 0) or 0,
        )
        return data

    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any] | None:
        raw = raw.strip()
        # Strip optional ```json fences
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract the outermost JSON object.
            m = re.search(r"\{[\s\S]*\}", raw)
            if not m:
                return None
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None

    # ------------------------------------------------------------------
    # Typed entry points used by the signal modules
    # ------------------------------------------------------------------
    def analyze_spinoff(self, filing: Filing, doc: bytes) -> dict[str, Any] | None:
        return self._extract(filing, "spinoff_v1", doc, deep=True)

    def analyze_activist_13d(self, filing: Filing, doc: bytes) -> dict[str, Any] | None:
        return self._extract(filing, "activist_v1", doc, deep=False)

    def analyze_form4(self, filing: Filing, doc: bytes) -> dict[str, Any] | None:
        return self._extract(filing, "form4_v1", doc, deep=False)

    def extract_supply_chain(self, filing: Filing, doc: bytes) -> dict[str, Any] | None:
        return self._extract(filing, "supply_chain_v1", doc, deep=True)
