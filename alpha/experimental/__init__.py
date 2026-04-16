"""Unvalidated / speculative signal detectors.

These modules exist but are NOT part of the production run-set. They
were designed based on literature + domain reasoning but never
validated with a rigorous walk-forward on our data.

Do NOT deploy capital based on these signals without running the same
kind of walk-forward we ran for spin-offs.

Signals here:
  - activists.py        (regime-dependent; 2022-24 small-cap had no edge)
  - insiders.py         (literature-grounded, not locally validated)
  - post_bankruptcy.py  (signal exists, not backtested)
  - index_migration.py  (needs fundamentals feed to validate)
  - capital_allocator.py (speculative)
  - supply_chain.py     (Cohen-Frazzini, untested here)
  - hedging_language.py (Larcker-Zakolyukina, untested here)
  - ghost_ships.py      (fun idea, untested)
  - microcap_deep_value.py (candidate for next validation run)
  - spac_warrants.py    (needs live data integration)
"""
