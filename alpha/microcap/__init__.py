"""Microcap negative-EV sleeve — the second validated strategy.

Backtested 2018-2023 (full universe, 85 hits):
  - Mean return: +76.5% at 24m, +25.8% at 12m
  - Excess vs IWM: +59.6% at 24m, +14.6% at 12m
  - Hit rate: ~52% (fat-tail strategy, same structure as spinoffs)
  - Driven by outlier winners: BTU +979%, AVNW +736%, GME +1731%

Operating model:
  - Quarterly screen (after 10-K/Q filing season): scan full universe
  - Quality gate: recent annual OCF > $0.5M, revenue >= $10M and
    not declining >25% YoY, positive book equity, no SIC blacklist
  - Deploy candidates into 3-5 concurrent positions, hold 24 months
  - Equal-weight within sleeve

Reuses fundamentals + screener from alpha.experimental.microcap
(validated pipeline). This module adds the production scanner that
produces candidates for the deploy queue.
"""
from alpha.microcap.scanner import scan_microcap_candidates

__all__ = ["scan_microcap_candidates"]
