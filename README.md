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

## Strategy summary

Three sleeves for a risk-tolerant, high-cash-flow operator:

| Sleeve | Allocation | Purpose |
|---|---|---|
| Special situations | 40-50% | Event-driven (spin, 13D, post-BK, activist) |
| Micro/nano-cap deep value | 20-30% | Structural coverage inefficiency |
| LEAPS / high-conviction concentrated | 10-20% | Leveraged upside on best ideas |
| Dry powder (T-bills) | 10-20% | Dislocation ammunition |

Rules (non-negotiable):

- Max 10% per position at market, 8% at cost.
- Max 20% LEAPS sleeve. Max 5% "lottery" sleeve.
- Pre-mortem each position before entry.
- 30% portfolio drawdown → 2-week new-deployment freeze.
- 6 months living expenses *outside* the portfolio (so you're never a
  forced seller yourself).

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
alpha init                 # create data dirs + DB
alpha run                  # full daily run: scan + extract + score + digest
alpha run --no-llm         # scan + score only (skip LLM extractions)
alpha run -s spinoff       # run a single signal
alpha digest               # regenerate today's digest from stored hits
alpha signals --days 14    # view the raw signal log
```

Digest lands at `data/reports/digest-YYYY-MM-DD.md`.

## Cron setup

```
# Run every weekday morning at 07:00 ET
0 7 * * 1-5 cd ~/alpha && .venv/bin/python scripts/daily_run.py
```

## Backtest

```bash
alpha backtest --prices data/prices.parquet
```

The prices file needs a MultiIndex `[date, ticker]` with columns
`adj_close`, `market_cap`, `in_universe`, and optionally `ebit_ev_yield`,
`return_on_capital`, `piotroski_f`, `altman_z` for the reference Magic
Formula strategy.

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
