"""Microcap deep-value signal validation.

Phase B of the roadmap: validate the Acquirer's Multiple / Carlisle
thesis — do negative-EV stocks with positive trailing FCF really
deliver excess returns?

Pipeline:
  universe.py    — build CIK universe
  fundamentals.py — pull point-in-time balance-sheet + FCF from XBRL
  screener.py    — negative-EV + FCF quality screen at a given date
  backtest.py    — walk-forward harness

This is validation work, not production. Do NOT deploy capital based
on this signal until the backtest produces results comparable to
spin-offs' +45% CAGR with honest methodology.
"""
