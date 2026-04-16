"""Spinoff sleeve — the validated core strategy.

Backtested 2015-2024 (walk-forward, no look-ahead):
  - Nano + small newcos, 5 concurrent positions, 18m hold
  - Heuristic hard-pass filter (China VIE, OTC-only, shells)
  - +45% CAGR, 59% win rate, -42% worst single position loss

This module is the production surface. Everything else in the repo is
exploratory or supports this.
"""
from alpha.spinoffs.detector import detect_spinoffs, SpinoffCandidate
from alpha.spinoffs.heuristic import assess_spinoff, HeuristicAssessment
from alpha.spinoffs.sizer import classify_size, size_bucket_ok
from alpha.spinoffs.ticker import resolve_ticker

__all__ = [
    "detect_spinoffs", "SpinoffCandidate",
    "assess_spinoff", "HeuristicAssessment",
    "classify_size", "size_bucket_ok",
    "resolve_ticker",
]
