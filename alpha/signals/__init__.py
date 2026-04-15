"""Signal detectors. Each module exports a subclass of Signal."""
from alpha.signals.base import Signal, SignalHit
from alpha.signals.spinoffs import SpinoffSignal
from alpha.signals.activists import ActivistSignal
from alpha.signals.insiders import InsiderClusterSignal
from alpha.signals.post_bankruptcy import PostBankruptcySignal
from alpha.signals.index_migration import IndexMigrationSignal
from alpha.signals.capital_allocator import CapitalAllocatorRegimeSignal
from alpha.signals.supply_chain import SupplyChainSignal
from alpha.signals.hedging_language import HedgingLanguageSignal
from alpha.signals.ghost_ships import GhostShipSignal

ALL_SIGNALS: list[type[Signal]] = [
    SpinoffSignal,
    ActivistSignal,
    InsiderClusterSignal,
    PostBankruptcySignal,
    IndexMigrationSignal,
    CapitalAllocatorRegimeSignal,
    SupplyChainSignal,
    HedgingLanguageSignal,
    GhostShipSignal,
]

__all__ = ["Signal", "SignalHit", "ALL_SIGNALS"]
