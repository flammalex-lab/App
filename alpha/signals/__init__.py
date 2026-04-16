"""Production signal detectors. Currently: spin-offs only.

Other signals are in alpha/experimental/signals/ — untested; do not
deploy capital based on them without validation."""
from alpha.signals.base import Signal, SignalHit
from alpha.signals.spinoffs import SpinoffSignal

ALL_SIGNALS: list[type[Signal]] = [
    SpinoffSignal,
]

__all__ = ["Signal", "SignalHit", "ALL_SIGNALS"]
