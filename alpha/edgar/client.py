"""SEC EDGAR HTTP client.

Key design decisions:
- Token-bucket rate limiting to stay safely under SEC's 10 req/s ceiling.
- On-disk cache keyed by URL; periodic filings rarely change, so TTL is long.
- Full-text search via the EFTS endpoint (undocumented but stable).
- Retries with exponential backoff for 5xx and 429 responses.

SEC requires a descriptive User-Agent identifying the caller. Set
EDGAR_USER_AGENT in the environment (see .env.example).
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from alpha.config import DATA_DIR, settings

log = logging.getLogger("alpha.edgar")


class RateLimiter:
    """Thread-safe token bucket. Simple and good enough for a single-process poller."""

    def __init__(self, rps: int):
        self.rps = max(1, rps)
        self._lock = threading.Lock()
        self._tokens = float(rps)
        self._last = time.monotonic()

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self._last
                self._tokens = min(self.rps, self._tokens + elapsed * self.rps)
                self._last = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                wait = (1.0 - self._tokens) / self.rps
            time.sleep(wait)


@dataclass
class Filing:
    cik: str
    accession: str
    form: str
    filed: date
    company: str
    primary_doc: str
    ticker: str | None = None

    @property
    def url(self) -> str:
        acc_nodash = self.accession.replace("-", "")
        cik_int = int(self.cik)
        return (
            f"https://www.sec.gov/Archives/edgar/data/"
            f"{cik_int}/{acc_nodash}/{self.primary_doc}"
        )

    @property
    def index_url(self) -> str:
        acc_nodash = self.accession.replace("-", "")
        cik_int = int(self.cik)
        return (
            f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany"
            f"&CIK={cik_int}&type={self.form}&dateb=&owner=include&count=40"
        )


class EdgarClient:
    def __init__(self, user_agent: str | None = None):
        cfg = settings().edgar
        ua = user_agent or cfg.user_agent
        if not ua:
            raise RuntimeError(
                "EDGAR_USER_AGENT is required. Set it in your environment. "
                "SEC requires a descriptive UA like 'Jane Doe jane@example.com'."
            )
        self._limiter = RateLimiter(cfg.rate_limit_rps)
        self._cache_dir = DATA_DIR / "cache"
        self._cache_ttl = timedelta(hours=cfg.cache_ttl_hours)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = httpx.Client(
            headers={
                "User-Agent": ua,
                "Accept-Encoding": "gzip, deflate",
                "Host": "www.sec.gov",
            },
            timeout=30.0,
            follow_redirects=True,
        )
        self._cfg = cfg

    # ------------------------------------------------------------------
    # Low-level fetchers
    # ------------------------------------------------------------------
    def _cache_path(self, url: str) -> Path:
        key = hashlib.sha256(url.encode()).hexdigest()[:24]
        return self._cache_dir / f"{key}.bin"

    def _cache_get(self, url: str) -> bytes | None:
        p = self._cache_path(url)
        if not p.exists():
            return None
        if datetime.now().timestamp() - p.stat().st_mtime > self._cache_ttl.total_seconds():
            return None
        return p.read_bytes()

    def _cache_put(self, url: str, data: bytes) -> None:
        self._cache_path(url).write_bytes(data)

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.HTTPStatusError)),
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        reraise=True,
    )
    def _get(self, url: str, host: str | None = None, use_cache: bool = True) -> bytes:
        if use_cache:
            cached = self._cache_get(url)
            if cached is not None:
                return cached
        self._limiter.acquire()
        headers: dict[str, str] = {}
        if host:
            headers["Host"] = host
        r = self._client.get(url, headers=headers)
        if r.status_code in (429, 503):
            # transient — let tenacity retry
            raise httpx.HTTPStatusError("throttled", request=r.request, response=r)
        r.raise_for_status()
        data = r.content
        if use_cache:
            self._cache_put(url, data)
        return data

    # ------------------------------------------------------------------
    # High-level endpoints
    # ------------------------------------------------------------------
    def full_text_search(
        self,
        forms: list[str],
        *,
        start: date | None = None,
        end: date | None = None,
        query: str | None = None,
        ciks: list[str] | None = None,
        max_pages: int = 10,
    ) -> Iterator[dict[str, Any]]:
        """Yield hits from EDGAR's full-text search.

        Uses the efts.sec.gov/LATEST/search-index JSON endpoint. Each hit
        contains source metadata we parse into Filing objects.
        """
        start = start or (date.today() - timedelta(days=7))
        end = end or date.today()
        host = "efts.sec.gov"
        from_ = 0
        size = 100
        for _ in range(max_pages):
            params = {
                "forms": ",".join(forms),
                "dateRange": "custom",
                "startdt": start.isoformat(),
                "enddt": end.isoformat(),
                "from": from_,
            }
            if query:
                params["q"] = f'"{query}"'
            if ciks:
                params["ciks"] = ",".join(ciks)
            # EFTS expects query params on search-index; easier to build a URL.
            url = f"{self._cfg.efts_url}?" + "&".join(
                f"{k}={v}" for k, v in params.items()
            )
            try:
                data = self._get(url, host=host, use_cache=True)
                payload = json.loads(data)
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                log.warning("EFTS failed: %s", e)
                return
            hits = payload.get("hits", {}).get("hits", [])
            if not hits:
                return
            for h in hits:
                yield h
            if len(hits) < size:
                return
            from_ += size

    def filings_for(
        self,
        forms: list[str],
        *,
        start: date | None = None,
        end: date | None = None,
        ciks: list[str] | None = None,
    ) -> Iterator[Filing]:
        """Yield parsed Filing objects."""
        for h in self.full_text_search(forms, start=start, end=end, ciks=ciks):
            src = h.get("_source", {})
            adsh = h.get("_id", "").split(":")[0]
            ciks_list = src.get("ciks") or [src.get("cik")]
            display = src.get("display_names") or []
            company = display[0] if display else src.get("company", "")
            form = src.get("form") or src.get("root_form", "")
            filed_s = src.get("file_date") or src.get("filing_date")
            try:
                filed_d = datetime.strptime(filed_s, "%Y-%m-%d").date()
            except (TypeError, ValueError):
                filed_d = date.today()
            primary = src.get("xsl") or h.get("_id", "").split(":")[-1]
            yield Filing(
                cik=str(ciks_list[0]).zfill(10),
                accession=adsh,
                form=form,
                filed=filed_d,
                company=company,
                primary_doc=primary,
            )

    def company_submissions(self, cik: str) -> dict[str, Any]:
        """Fetch the CIK's submission history JSON."""
        cik10 = str(cik).zfill(10)
        url = f"{self._cfg.data_url}/submissions/CIK{cik10}.json"
        data = self._get(url, host="data.sec.gov")
        return json.loads(data)

    def company_tickers(self) -> dict[str, Any]:
        """All EDGAR-registered tickers with their CIKs."""
        url = f"{self._cfg.base_url}/files/company_tickers.json"
        data = self._get(url, host="www.sec.gov")
        return json.loads(data)

    def download_primary_document(self, filing: Filing) -> bytes:
        """Fetch the primary document (HTML/TXT) for a given filing."""
        return self._get(filing.url, host="www.sec.gov", use_cache=True)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "EdgarClient":
        return self

    def __exit__(self, *a: Any) -> None:
        self.close()
