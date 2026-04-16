# Alpha Roadmap

## Phase A — Refactor to validated core (current)

Status: **DONE**.

- Extracted spin-off sleeve into `alpha/spinoffs/`
- Built `alpha/portfolio/` — ledger, deploy queue, paper trader
- Repurposed LLM layer as analyst (not gatekeeper)
- Moved 10+ unvalidated signals to `alpha/experimental/`
- Simplified CLI: `scan` → `step` → `digest`
- Ship: deploy-queue digest, position ledger, paper-trading engine

## Phase B — Validate one more signal

Status: **NEXT**.

Pick ONE signal from `alpha/experimental/` and run the same rigorous
walk-forward that validated spin-offs. If it works, promote to
production. If not, confirm the demotion.

**Candidate: microcap deep value (negative-EV with quality gate).**

Required work:
1. Historical universe of US micro-caps 2015-2024 with fundamentals
   (market cap, cash, debt, FCF). Cheapest source: SEC XBRL Company
   Facts API iterated across CIKs. ~2-4 hours of ETL.
2. Monthly screening: flag names where market cap < net cash AND
   3y cumulative FCF > 0.
3. Walk-forward: buy all qualifying names each month, hold 24 months.
4. Measure: CAGR, hit rate, worst loss, vs IWM.

Alternative candidates (in order of likely value):
- **Post-bankruptcy emergence**: curated list of historical emergences
  + forward return analysis. Needs bankruptcy docket data (PACER, free
  alternatives exist).
- **Odd-lot tender offers**: narrow but clean alpha. Needs tender-offer
  announcement scraper.
- **Insider clusters**: Form 4 cluster detection. Literature-validated
  but never tested on our specific universe.

## Phase C — Paper trade

Status: **AFTER B**.

Run the validated pipeline in paper mode for 8-12 weeks. Measure:
- Deploy latency: Form 10 → queue → deployment
- Fill success rate: how many queue candidates make it to ledger
- Per-position P&L mark-to-market
- Portfolio-level equity curve vs backtest expectation

Abort triggers:
- Systematic filtering bugs (live universe looks different from backtest)
- Queue freshness issues (stale candidates accumulating)
- Execution timing mismatches

## Phase D — Live capital

Status: **AFTER C**.

Starting allocation: whatever fraction of net worth you're comfortable
potentially losing 50% of. This strategy WILL drawdown.

Ramp plan:
- Week 1-4: 20% of planned allocation
- Week 5-12: 50%
- Week 13+: 100%

Monitor:
- Live vs paper divergence (should be < 50 bps per month)
- Tax lot tracking
- Rebalance discipline (resist discretionary exits)

## Not on the roadmap (explicit non-goals)

- Daily market-timing signals
- Leverage / margin (Kelly-sized beyond equal weight)
- Options overlays (LEAPS recommender was built but not validated)
- Short selling
- International spin-offs (needs separate ticker + fundamentals pipeline)
- HFT / intraday anything
