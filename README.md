# Alpha

Event-driven + deep-value research system for asymmetric equity bets, built
for a young, high-cash-flow, risk-tolerant operator. Opinionated: it looks
specifically for situations the market **structurally can't or won't**
analyze — spin-offs, activist targets, post-bankruptcy equities, insider
clusters, index migrations, ghost ships.

The thesis: your edge as an individual is not information, it's
**breadth × patience × willingness to buy the un-buyable.** This system
gives you breadth (daily EDGAR firehose + LLM extraction) and helps
enforce patience (rule-based scoring, drawdown circuit breaker).

## What it does

1. **Scans SEC EDGAR** daily for 15+ form types that surface high-signal
   events (Form 10, SC 13D, Form 4, 8-K with keywords, NT 10-K, Form 25,
   T-3, etc.).
2. **LLM-extracts structured data** from each filing against strict
   pydantic schemas (spinoff_v1, activist_v1, form4_v1, supply_chain_v1).
3. **Runs signal detectors**:
   - `spinoff` — small, ugly spin-offs with forced-selling indicators
   - `activist_13d` — 13D filings, boosted for whitelisted small-cap activists
   - `insider_cluster` — multi-insider open-market buying with role diversity
   - `post_bankruptcy` — fresh-start equities with NOLs and no coverage
   - `index_migration` — S&P 500/400/600 promotion candidates *(original)*
   - `capital_allocator_regime` — new-CFO + buyback + insider-buy compound events *(original)*
   - `supply_chain_cascade` — customer-to-supplier return predictability *(original)*
   - `hedging_language` — CFO linguistic tells (Larcker-Zakolyukina) *(original)*
   - `ghost_ship` — post-Form-15 companies that may still be profitable *(original)*
4. **Composite scoring** — weights signals, rewards multi-signal stacking
   on the same name with a 15-25% bonus.
5. **Daily markdown digest** with a ranked table and an operator checklist.
6. **Walk-forward backtest harness** — validates any rule-based strategy
   before committing capital.

## Strategy summary — Aggressive (calibrated to backtest)

For a young, cash-flow-rich, risk-tolerant operator. The walk-forward
shows **+44% CAGR** is achievable from a top-5-per-year concentration
in nano + small spin-offs alone (10-year sim, $100k → $3.76M, pre-tax).

Realistic target after taxes + slippage + execution discipline:
**25-35% annualized.**

| Sleeve | Allocation | Mechanism | Per-position expectation |
|---|---:|---|---:|
| **Concentrated nano/small spin-offs** | 35-45% | Top 5-7 per year, 5-10% each | +50-60% over 18m |
| **LEAPS overlay on highest conviction** | 10-20% | 24m calls 5-10% OTM, 1-3% per name | +100-300% when right |
| **Special situations** | 15-20% | 13D coattails, mergers, post-BK | +20-30% per event |
| **Microcap deep value** | 10-15% | Negative-EV with quality gate | +30-60% over 24m |
| **Lottery (SPAC warrants, biotech)** | 5-10% | 1% positions, diversified | -100% / +500-1000% |
| **Dry powder (T-bills)** | 5-15% | Dislocation ammunition | T-bill rate |

### Rules (non-negotiable)

- Max 10% per position at market, 8% at cost.
- Max 20% LEAPS sleeve. Max 10% "lottery" sleeve.
- Use Kelly fraction (¼- to ½-Kelly) for sizing, capped by hard caps.
- 5% cash floor minimum. Build to 15% during obvious bubbles.
- Drawdown circuit breaker: 30% portfolio drop → 2-week new-deployment
  freeze (forces you to re-evaluate, not panic-sell).
- 6 months living expenses *outside* the portfolio so cash flow can
  fund DCAs through drawdowns instead of you being a forced seller.
- Pre-mortem each position before entry.
- LEAPS only when IV is in bottom half of 1y range — never pay for
  someone else's fear.

## Install

```bash
cd App
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env
# Edit .env: set EDGAR_USER_AGENT and ANTHROPIC_API_KEY
```

`EDGAR_USER_AGENT` is mandatory — the SEC requires it in every request
and will block you without one. Use the format: `Your Name email@example.com`.

## Quickstart

```bash
alpha init                                     # create data dirs + DB
alpha run                                      # daily scan + extract + score + digest
alpha run --no-llm                             # skip LLM extractions
alpha run -s spinoff                           # run a single signal
alpha digest                                   # broad watchlist (top 25)
alpha concentrated --top 5 -p 200000 -a 1.2    # AGGRESSIVE: top-5 high-conviction
                                               # picks with Kelly sizing for $200k portfolio
alpha signals --days 14                        # raw signal log
```

The **concentrated** digest is the one to use as an aggressive operator.
It scores each name with the ConvictionScorer, applies Kelly sizing
(¼- to ½-Kelly capped at hard limits), and recommends LEAPS overlays
on the highest-conviction picks. Output at
`data/reports/concentrated-YYYY-MM-DD.md`.

## Cron setup

```
# Run every weekday morning at 07:00 ET
0 7 * * 1-5 cd ~/alpha && .venv/bin/python scripts/daily_run.py
```

## Backtest

Two event studies ship with free data via yfinance:

```bash
pip install -e '.[backtest]'

alpha backtest-spinoffs                     # 27 historical spin-offs
alpha backtest-activists                    # 28 historical 13D campaigns
alpha backtest --prices data/prices.parquet # Magic Formula reference
```

### Key empirical findings

Full write-ups in `data/backtest/`:
- `SUMMARY.md` — initial curated event studies
- `WALK_FORWARD_ANALYSIS.md` — honest pipeline test (no curation)
- `SIZE_FILTER_FINDINGS.md` — Greenblatt thesis confirmed
- `concentration_study.md` — top-N concentration test

**Walk-forward 2015-2024 spin-offs (n=197 raw, ~120 with size data):**
- Nano newcos (<$500M): +47.9% excess vs IWM at 18m
- Small newcos ($500M-$2B): +39.9% excess vs IWM at 18m
- Mid newcos ($2B-$10B): +7.1% excess (the trap — avoid weighting)
- Large newcos (>$10B): +23.0% excess at 18m

**Concentration test (top-N per year by smallest mcap, recycled capital):**
- Top 10 per year: +43% CAGR over 10 years
- Top 5 per year: **+44.1% CAGR** ($100k → $3.76M pre-tax)
- Top 3 per year: **+44.2% CAGR**

**Activist 13Ds (2019-2023)**: Large-cap targets beat IWM by +33% over
24m; small-cap targets underperformed in the weak 2022-24 regime. The
system now **requires stacking confirmation** for small-cap activist
signals.

The Magic Formula harness expects a prices parquet/csv with MultiIndex
`[date, ticker]` and columns `adj_close`, `market_cap`, `in_universe`,
and optionally `ebit_ev_yield`, `return_on_capital`, `piotroski_f`,
`altman_z`.

Data sources (cheap/free):
- **Sharadar SF1/SEP** — ~$50/mo, point-in-time fundamentals.
- **Polygon** — real-time + historical prices.
- **SEC EDGAR + financial statement datasets** — free fundamentals via
  the XBRL files.

## Configuration

All tunables live in `config/`:

- `settings.yaml` — signal enable/disable flags, thresholds, scoring weights.
- `activists.yaml` — whitelist of small-cap activists (edit quarterly).
- `universe.yaml` — sector/structure exclusions, priority sub-universes.

## Architecture

```
alpha/
  edgar/       SEC EDGAR client (rate-limited, cached)
  signals/     Each strategy as a detector class
  llm/         Claude-powered structured extraction
  store/       SQLite persistence (schema.sql)
  scoring/     Composite ranking with multi-signal bonus
  digest/      Markdown report rendering
  backtest/    Walk-forward harness
  cli.py       Typer CLI
config/        YAML config files
scripts/       Cron entry points
data/          Runtime outputs (gitignored)
```

## Strategy references

- Greenblatt, *You Can Be a Stock Market Genius* — spin-offs, special situations.
- Greenblatt, *The Little Book That Still Beats the Market* — Magic Formula.
- Piotroski (2000) — F-score, free on SSRN.
- Brav, Jiang, Partnoy, Thomas (2008) — hedge fund activism returns.
- Lakonishok & Lee (2001); Cohen, Malloy, Pomorski (2012) — insider trades.
- Cohen & Frazzini (2008) — economic-link predictability.
- Larcker & Zakolyukina (2012) — conference-call linguistic tells.
- Chen, Noronha, Singal (2004) — S&P index inclusion effect.

## What this is NOT

- Not a prediction system. It's a *surfacing* system. Every flagged idea
  still needs you to read the primary documents.
- Not optimized for tax efficiency — put the active sleeves in a Roth.
- Not a substitute for risk management. Position sizing is on you.
- Not a covered-universe system. Micro-caps, ghost ships, and
  pink-sheet names are intentionally in scope.

## Extending

Add a new signal:
1. Drop a module in `alpha/signals/your_signal.py` with a `YourSignal(Signal)`
   class and a `detect()` method yielding `SignalHit`.
2. Register it in `alpha/signals/__init__.py`.
3. Add its config block + weight in `config/settings.yaml` and
   `alpha/scoring/composite.py`.

Add a new LLM extraction schema:
1. Add the pydantic model in `alpha/llm/schemas.py`.
2. Add the prompt in `alpha/llm/prompts.py`.
3. Expose a typed entry point on `LLMAnalyzer`.
