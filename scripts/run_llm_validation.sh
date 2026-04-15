#!/usr/bin/env bash
# Full LLM validation pipeline.
#
# Prereqs:
#   1. export EDGAR_USER_AGENT="Your Name you@example.com"
#   2. export ANTHROPIC_API_KEY=sk-ant-...
#   3. pip install -e '.[backtest]'
#
# Cost: ~$20 one-time for ~200 historical Form 10s. Cached.
# Re-running is free unless you add new events.

set -euo pipefail

if [[ -z "${EDGAR_USER_AGENT:-}" ]]; then
    echo "ERROR: EDGAR_USER_AGENT not set. See .env.example."
    exit 1
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "WARNING: ANTHROPIC_API_KEY not set — will run in dry-run mode."
    echo "  Get a key at https://console.anthropic.com/ then:"
    echo "  export ANTHROPIC_API_KEY=sk-ant-..."
    DRY_RUN="--dry-run"
else
    DRY_RUN=""
fi

echo ""
echo "=== 1/2: LLM backfill (up to \$25 budget) ==="
python scripts/llm_backfill.py --budget-usd 25 $DRY_RUN

echo ""
echo "=== 2/2: Re-run chronological backtest with LLM filter ==="
python scripts/backtest_with_llm.py \
    --csv data/backtest/walk_forward_2015-01-01_2024-12-31/spinoff_events_with_llm.csv

echo ""
echo "=== Done. Results: ==="
echo "  data/backtest/realtime_with_llm.md"
echo "  data/backtest/walk_forward_2015-01-01_2024-12-31/spinoff_events_with_llm.csv"
