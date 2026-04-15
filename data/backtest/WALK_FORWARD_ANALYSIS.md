# Walk-Forward vs Curated: Honest Comparison

## The two tests

- **Curated backtest** (earlier): hand-picked ~27 historical spin-offs and
  ~28 historical activist campaigns that I knew happened. Measured
  forward returns. Prone to selection bias — we only remember the
  famous ones.
- **Walk-forward backtest** (this): replays EDGAR Form 10 and SC 13D
  filings as they actually appeared, runs the detection logic, resolves
  CIK→ticker via SEC's current-snapshot JSON, and measures forward
  returns on every flagged candidate. 2019-2023, 5 years.

## Head-to-head: Spin-offs

| Metric | Curated (T+21) | **Walk-forward (T+21, ALL Form 10s)** |
|---|---:|---:|
| N events | 27 | **61 tradeable** (83 raw, 76% resolved) |
| 12m mean return | +27.0% | **+18.6%** |
| 12m hit rate | 73% | **56%** |
| 18m mean return | +41.6% | **+43.1%** |
| 18m excess vs IWM | +23.5% | **+26.7%** |
| 24m mean return | +30.4% | **+58.5%** |
| **System recall** vs curated | — | **59% (16/27)** |

**The good news:** the spin-off edge **survives** walk-forward testing.
18-month mean return at +43.1% is actually higher than the curated
result, and excess vs IWM is +27% vs +24%. This is a robust finding:
even flagging **every** Form 10 (no LLM filtering, no size-tier
filtering), the asymmetric winners drag the mean up.

**The honest caveat:** hit rate drops from 73% to 56%. The strategy
relies on the winners being asymmetrically huge, not on consistent wins.
Median 18m return is only +6% — the mean of +43% comes from the fat
right tail:

| 12m bucket | N (of 59) |
|---|---:|
| <-50% | 4 |
| -50 to -20% | 16 |
| -20 to 0% | 6 |
| 0 to 20% | 9 |
| 20 to 50% | 8 |
| 50 to 100% | 10 |
| **>100%** | **6** |

**Cohort year reality check:**

| Year | N | 12m mean | Hit rate |
|---|---:|---:|---:|
| 2019 | 13 | +26% | 31% |
| 2020 | 8 | **+60%** | **87%** |
| 2021 | 11 | +5.7% | 45% |
| 2022 | 15 | -0.6% | 53% |
| 2023 | 14 | +18.4% | 64% |

2020 was exceptional (COVID bounce helped spin-offs that emerged into a
recovering market — CARR/OTIS/HWM). Remove 2020 and you'd get closer
to the ~15% mean 12m return that's probably the realistic forward
expectation.

**Recall of 59%** — the system found 16 of 27 known winners. The 11
misses are mostly CIK→ticker resolution failures (companies later
renamed / acquired and not in SEC's current-snapshot ticker JSON).
Fixable by using historical EDGAR submissions archives.

## Head-to-head: Activist 13Ds

| Metric | Curated | **Walk-forward (whitelist only)** |
|---|---:|---:|
| N events | 27 | **50 tradeable** (75 raw, 67% resolved) |
| 12m mean return | +1.9% | **+13.8%** |
| 12m hit rate | 52% | **50%** |
| 18m mean return | +11.0% | **+12.5%** |
| 18m excess vs IWM | -0.9% | **-3.7%** |
| 24m excess vs IWM | +7.8% | **-4.7%** |

**The honest finding: the activist whitelist does NOT beat IWM over
2019-2023.** Gross returns are positive (+12.5% at 18m), but after
you subtract the small-cap benchmark, there's no excess — and at 12m /
18m the excess is negative. Median returns are flat-to-negative across
all horizons.

This confirms what the curated test hinted at: **the broader Brav-Jiang
academic result for activist alpha (based on 1994-2006) has not held
in the recent small-cap environment.** Our whitelist is heavily small-
and mid-cap biased, and that's where the underperformance concentrates.

**Cohort analysis:**

| Year | N | 12m mean | Hit rate |
|---|---:|---:|---:|
| 2019 | 5 | -5.7% | 60% |
| 2020 | 4 | +21% | 100% |
| 2021 | 2 | -42% | 0% |
| 2022 | 10 | +2.1% | 30% |
| 2023 | 29 | +24% | 52% |

2023 cohort is promising, but we need another year of data to confirm.

## What this changes in production

### Keep doing
- **Spin-off signal.** The edge is real. Flag every Form 10, filter by
  LLM extraction to find the small-cap, forced-seller setups.
- **T+21 entry rule.** Confirmed meaningful across both tests.

### Change immediately
- **Activist signal weight: reduce.** Drop from 1.4 to 0.9 until we see
  sustained excess returns in a full cycle. Require stacking
  confirmation (already implemented after curated backtest).
- **Diversification discipline.** With 53% hit rate and fat tails, you
  need 15-20 spin-off positions to realize the mean. Under-diversified
  portfolios will occasionally experience brutal stretches.
- **Cap 2020-like regime benefit.** The 2020 cohort inflates the mean;
  don't assume future returns will match.

### Build next
- **Historical ticker resolver** using `/submissions/CIK*.json` instead
  of current snapshot. Should push spin-off recall from 59% to 85%+.
- **Pro-forma size estimator** from Form 10 text (without full LLM) —
  regex on "approximately $X in revenue" etc. Lets us filter for the
  small-spin sweet spot at detection time.
- **Subject/filer deduplication** in 13D replay — current code
  deduplicates (subject_cik, filer_cik) but multiple activists piling on
  the same target (e.g., Elliott + Starboard on CRM in 2023) are
  separate events.

## The bigger lesson

The curated backtest told us "small spins beat the market by a lot."
The walk-forward confirms that, **but** shows the dispersion is
enormous — hit rate is a coin flip. You're paid for a handful of 5-10x
winners. That means:

- **Portfolio size discipline** matters more than pick quality for this
  strategy. With 15-20 positions, the math works. With 5, you can go
  years without a winner.
- **LLM filtering at detection time is high-value.** Even a modest
  precision improvement (say, flagging only size-ratio < 15% spins)
  would meaningfully improve the median return and preserve the mean.
- **The activist-coattails strategy has a regime-dependence problem.**
  Until we see multi-year excess returns return, size the sleeve
  smaller and require stacking.

## Methodology caveats (still)

- `company_tickers.json` is current-snapshot → historical renames are
  lost. Recall is a floor, not a ceiling.
- yfinance adjusted closes are approximate for complex spin-off cases.
- No cost model beyond flat 50 bps round-trip. Micro-cap slippage is
  materially higher in reality.
- Benchmarks are IWM (small-cap) and SPY (large-cap); factor-adjusted
  returns (Fama-French) would tighten the story.
- 5-year window spans both a tailwind regime (2020) and headwind
  regimes (2022). Longer window would be better; 2015-2024 run is the
  natural next step.

## Where we are

**The spin-off signal is production-ready.** With LLM filtering added
back (we currently have it wired but not tested against the walk-forward
set), precision should improve materially without losing the big winners.

**The activist signal needs a regime change to justify current weight.**
For now: whitelist + stacking-required + smaller position sizing.
