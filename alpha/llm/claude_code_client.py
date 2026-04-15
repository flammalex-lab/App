"""Claude Code CLI adapter.

Drop-in replacement for `anthropic.Anthropic()` that shells out to the
`claude` CLI (Claude Code), billing usage against the user's Pro/Max
subscription instead of a pay-per-token API key.

Tradeoffs vs the real SDK:
  - PROS: zero incremental cost on existing plan.
  - CONS: slower (~5-10s subprocess startup per call), rate-limited by
    the plan window, less reliable.

Use case: ongoing daily scans (low volume, cost-sensitive).
Not recommended for bulk backfills unless you can run overnight.

Design notes:
  - We mimic the `anthropic.Anthropic().messages.create(...)` API so the
    rest of the code (score_filing_with_llm, etc.) is unchanged.
  - The `-p` flag runs Claude Code in one-shot print mode.
  - `--output-format json` gives us structured output we can parse.
  - `--append-system-prompt` injects our system prompt.
  - Prompt file is written to a temp file and piped via stdin for
    safety with large (>100k char) prompts.
  - Rate-limit errors trigger a long sleep + retry. Cache ensures
    progress is never lost.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger("alpha.llm.claude_code")


# Fake response class that matches what our code reads:
#   resp.content[i].text
#   resp.usage.input_tokens / output_tokens
@dataclass
class _TextBlock:
    text: str


@dataclass
class _Usage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class _Response:
    content: list[_TextBlock]
    usage: _Usage


# Model name aliases — CLI accepts short names like "sonnet"
_MODEL_ALIASES = {
    "claude-sonnet-4-6": "sonnet",
    "claude-sonnet-4-5": "sonnet",
    "claude-opus-4-6": "opus",
    "claude-opus-4-5": "opus",
    "claude-haiku-4-5-20251001": "haiku",
    "claude-haiku-4-5": "haiku",
}


class _RateLimitError(RuntimeError):
    pass


class ClaudeCodeClient:
    """anthropic-SDK-compatible shim that shells out to `claude -p`."""

    def __init__(self, claude_bin: str = "claude",
                  max_rate_limit_retries: int = 4,
                  base_backoff_seconds: int = 600):
        self.claude_bin = claude_bin
        self.max_rate_limit_retries = max_rate_limit_retries
        self.base_backoff_seconds = base_backoff_seconds
        # Verify the binary exists
        try:
            subprocess.run([claude_bin, "--version"],
                            capture_output=True, check=True, timeout=10)
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            raise RuntimeError(
                f"`{claude_bin}` CLI not found or not working: {e}. "
                "Install Claude Code from https://claude.com/code "
                "or use --no-use-claude-code to fall back to the API key."
            )
        # Expose .messages so client.messages.create(...) matches the SDK
        self.messages = self

    def create(self, *, model: str, max_tokens: int,
                system: str | list, messages: list[dict],
                **_kwargs: Any) -> _Response:
        """Mimic anthropic.messages.create API.

        `system` and `messages` follow the anthropic SDK shapes.
        Returns a fake _Response object with .content and .usage.
        """
        # Normalize system prompt
        if isinstance(system, list):
            system_text = "\n\n".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in system
            )
        else:
            system_text = str(system)

        # Extract user text (we only support single user turn)
        user_text = ""
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content")
                if isinstance(content, str):
                    user_text = content
                elif isinstance(content, list):
                    user_text = "\n".join(
                        b.get("text", "") if isinstance(b, dict) else str(b)
                        for b in content
                    )
                break

        # Write prompt to temp file — avoids arg-length limits
        prompt_file = None
        system_file = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, encoding="utf-8"
            ) as f:
                f.write(user_text)
                prompt_file = f.name
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, encoding="utf-8"
            ) as f:
                f.write(system_text)
                system_file = f.name

            model_alias = _MODEL_ALIASES.get(model, model)

            # Retry loop for rate-limit errors
            for attempt in range(self.max_rate_limit_retries):
                try:
                    return self._invoke(prompt_file, system_file, model_alias)
                except _RateLimitError:
                    wait = self.base_backoff_seconds * (2 ** attempt)
                    log.warning(
                        "Claude Code rate limit hit; sleeping %d min before "
                        "retry %d/%d", wait // 60,
                        attempt + 1, self.max_rate_limit_retries,
                    )
                    time.sleep(wait)
            raise RuntimeError("Rate-limit retries exhausted.")
        finally:
            for p in (prompt_file, system_file):
                if p and Path(p).exists():
                    Path(p).unlink()

    def _invoke(self, prompt_file: str, system_file: str,
                 model: str) -> _Response:
        """One subprocess call. Raises _RateLimitError on rate-limit errors."""
        cmd = [
            self.claude_bin, "-p",
            "--output-format", "json",
            "--model", model,
            "--append-system-prompt", Path(system_file).read_text(),
        ]
        # Pipe the user prompt via stdin — safe for 100k+ char payloads
        with open(prompt_file, "rb") as pf:
            try:
                proc = subprocess.run(
                    cmd,
                    stdin=pf,
                    capture_output=True,
                    timeout=300,
                )
            except subprocess.TimeoutExpired:
                raise RuntimeError("Claude Code invocation timed out after 5m")

        stdout = proc.stdout.decode("utf-8", errors="ignore")
        stderr = proc.stderr.decode("utf-8", errors="ignore")

        if proc.returncode != 0:
            combined = (stdout + "\n" + stderr).lower()
            if any(kw in combined for kw in
                    ("rate limit", "usage limit", "too many requests",
                     "quota", "429")):
                raise _RateLimitError(stderr[:300])
            raise RuntimeError(
                f"Claude CLI exited {proc.returncode}. "
                f"stderr: {stderr[:500]}"
            )

        # Parse the JSON envelope
        try:
            envelope = json.loads(stdout)
        except json.JSONDecodeError:
            # Some versions of Claude Code stream multiple JSON objects;
            # take the last one.
            matches = re.findall(r"\{[\s\S]*?\}(?=\s*\{|\s*$)", stdout)
            if not matches:
                raise RuntimeError(f"Unparseable Claude CLI output: {stdout[:400]}")
            try:
                envelope = json.loads(matches[-1])
            except json.JSONDecodeError:
                raise RuntimeError(f"Unparseable Claude CLI output: {stdout[:400]}")

        # Extract the actual response text
        if envelope.get("is_error"):
            subtype = envelope.get("subtype", "")
            msg = envelope.get("result") or envelope.get("error") or ""
            if "rate" in str(msg).lower() or "limit" in str(msg).lower():
                raise _RateLimitError(str(msg)[:300])
            raise RuntimeError(f"Claude CLI error [{subtype}]: {msg}")

        text = envelope.get("result", "")
        usage = envelope.get("usage", {}) or {}

        return _Response(
            content=[_TextBlock(text=text)],
            usage=_Usage(
                input_tokens=int(usage.get("input_tokens", 0) or 0),
                output_tokens=int(usage.get("output_tokens", 0) or 0),
            ),
        )
