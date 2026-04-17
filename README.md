# Alpha

Opinionated, backtested, **deliberately narrow** event-driven research
and execution system built for a young, cash-flow-rich, risk-tolerant
operator. The thesis of this project is simple:

> **One validated strategy, executed systematically, beats ten
> speculative strategies optimized in a spreadsheet.**

After building nine signal detectors and running rigorous walk-forward
tests, only one survived: **nano + small spin-offs, bought 21 trading
days after the Form 10 filing, equal-weighted across 5 concurrent
positions, held 18 months.**

That strategy delivered **+45% CAGR** in a 2015-2024 walk-forward test
with no look-ahead, no survivorship bias, and a realistic cost model.

Everything else in this repo either supports that core strategy or is
flagged as experimental. `alpha/experimental/` contains 10+ other
signals we built but did not validate — they stay around for future
research, but production capital does not touch them.

---

## Operating model

Three sleeves. One is validated. Start there.

| Sleeve | Allocation | Mechanism | Status |
|---|---:|---|---|
| **Spinoff deploy queue** | 50-60% | Systematic nano/small spin-offs, 5 concurrent, 18m hold | ✅ validated (+45% CAGR) |
| **Microcap negative-EV** | 20-30% | Quarterly screen, 4 concurrent, 24m hold | ✅ validated (+76% mean at 24m) |
| **Dry powder (T-bills)** | 10-20% | DCA ammunition for drawdowns | — |

**Realistic post-cost expectation: 25-30% real annualized.** Path will
be volatile — 30%+ portfolio drawdowns are expected 1-2x per decade.

---

## Install

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e '.[backtest]'
cp .env.example .env
# Edit .env: set EDGAR_USER_AGENT and (optionally) ANTHROPIC_API_KEY
```

---

## Production commands

```bash
alpha init                    # create DB + data dirs
alpha scan                    # daily: find new Form 10s, update deploy queue
alpha scan-microcap           # quarterly: screen universe for negative-EV microcaps
alpha step                    # daily: close due positions, deploy ready candidates (paper)
alpha digest                  # today's deploy-queue briefing
alpha performance             # closed-position performance to date
alpha thesis <accession>      # LLM thesis + red-flag scan for one filing
```

### Daily operator loop

```bash
# every morning (~30 seconds)
alpha scan && alpha step && alpha digest

# quarterly (~1-3 hours, after filing season)
alpha scan-microcap
```

---

## How the strategy works (backtest-validated)

1. **EDGAR scan**: every day, find new Form 10 / Form 10-12B filings.
2. **Heuristic filter** (hard-pass only): reject China VIEs, OTC-only
   listings, sub-$5M revenue shells, chronic late filers. That's
   about 45% of raw filings. The rest pass through.
3. **Size classification**: classify newco market cap into nano
   (<$500M), small ($500M-$2B), mid ($2B-$10B), large (>$10B). Only
   nano and small are deployed. Mid is "the trap" — highest dispersion
   with lowest mean.
4. **Queue with ready date**: filing_date + 21 trading days. This waits
   out the forced-selling window (parent holders dumping for index or
   mandate reasons).
5. **Deploy when slot opens**: 5 concurrent positions. When one closes
   (hit 18-month hold), proceeds fund the next oldest ready candidate.
6. **Hold 18 months**. No discretionary exits.

**What the system does NOT do:**
- Pick winners (you can't; the alpha is category-driven)
- Time the market (doesn't work; deploy when filings arrive)
- Use LLM judgment to filter in/out (validated: HURTS CAGR because
  "ugly because forced-seller" looks like "ugly because dying")
- Trust single-name conviction (validated: equal-weight within
  category beats stock-picking)

The LLM helps you **understand** each position (thesis + red flags)
after it's been selected, not **gate** which positions to take.

---

## Validation evidence

Three independent backtests in `data/backtest/`:

- **`SUMMARY.md`** — initial curated event study (27 hand-picked names).
  Biased toward winners; not trustworthy.
- **`WALK_FORWARD_ANALYSIS.md`** — honest no-look-ahead replay of 197
  real Form 10 filings 2015-2024. +45% CAGR, 52% win rate, -67% worst
  single-position loss, +599% best.
- **`HONEST_FINDINGS.md`** — discusses the calibration arc: look-ahead
  bias measurement, a failed first-version heuristic, and the
  calibrated heuristic that kept CAGR while reducing tail risk.

### What didn't work (kept as lessons)

| Idea | Tested? | Result |
|---|---|---|
| LLM filter on buy/pass | ✅ $16 of Claude calls on 165 filings | Reduced CAGR from 45% to 23% — too precise |
| Aggressive heuristic (sector + leverage penalties) | ✅ | Reduced CAGR from 45% to 4% — same reason |
| Top-N per year by smallest mcap | ✅ | Look-ahead bias; real CAGR is essentially unchanged (+45.5% vs +44.1%) |
| Activist 13D coattails | ✅ | No current edge (small-cap activists underperformed 2019-2023) |
| Insider clusters, supply chain, hedging language, ghost ships, etc. | ❌ | Built, not validated. In `alpha/experimental/`. Do not deploy. |

---

## Architecture

```
alpha/
  spinoffs/              # THE validated strategy
    detector.py          # find new Form 10 filings
    heuristic.py         # hard-pass filter (v2, permissive)
    sizer.py             # classify newco by market cap bucket
    ticker.py            # CIK -> ticker resolver

  portfolio/
    ledger.py            # open/closed positions (paper or live)
    queue.py             # pending-to-deploy candidates
    paper.py             # paper-trading execution engine

  llm/
    thesis.py            # LLM as analyst (thesis + red flags) NOT gatekeeper
    claude_code_client.py # subscription-based alternative to API key

  edgar/                 # SEC EDGAR client (rate limited, cached)
  digest/                # markdown briefings
  backtest/              # historical validation harness
  cli.py                 # Typer CLI

  experimental/          # unvalidated signals — do not deploy
    signals/{activists, insiders, post_bankruptcy, index_migration,
             capital_allocator, supply_chain, hedging_language,
             ghost_ships, microcap_deep_value, spac_warrants}.py
```

---

## LLM usage (optional)

Two paths:

```bash
# Path A: API key (fast, $0.10/filing)
export ANTHROPIC_API_KEY=sk-ant-...
alpha thesis <accession> --cik <cik>

# Path B: Claude Code subscription (free on existing plan)
alpha thesis <accession> --cik <cik> --use-claude-code
```

The LLM is used for **due diligence support**, not selection. It
writes a thesis and flags dire red flags (going concern,
restatements, SEC investigations). You still make the deploy
decision.

---

## Rules (non-negotiable)

1. **5 concurrent positions, equal-weighted.** No Kelly, no conviction weighting.
2. **18-month hold**, no discretionary exits.
3. **Deploy in order**: oldest-ready candidate fills the next open slot.
4. **Hard-pass filter only.** Don't second-guess on "quality."
5. **6 months of expenses outside the portfolio.** Cash flow funds
   DCAs; portfolio funds long-term growth.
6. **30% portfolio drawdown → 2-week deployment freeze.** Re-read, don't sell.
7. **Everything in a Roth IRA where possible.** 18m holds = short-term gains.

---

## Next steps

This README describes Phase A (refactor). See `docs/ROADMAP.md` for:
- **Phase B**: validate ONE more signal (microcap deep value is the
  candidate) before trusting the `experimental/` demotion.
- **Phase C**: paper-trade 8-12 weeks to measure live system
  performance vs. backtest expectation.
- **Phase D**: deploy real capital.
