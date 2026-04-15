#!/usr/bin/env python3
"""Daily runner. Intended to be invoked by cron.

Example cron entry (runs at 7am ET on weekdays):
    0 7 * * 1-5 cd /path/to/alpha && .venv/bin/python scripts/daily_run.py
"""
from __future__ import annotations

import logging
import sys

from alpha.cli import app


def main() -> int:
    logging.basicConfig(level=logging.INFO)
    try:
        app(["run"], standalone_mode=False)
        return 0
    except SystemExit as e:
        return int(e.code or 0)
    except Exception:
        logging.exception("daily run failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
