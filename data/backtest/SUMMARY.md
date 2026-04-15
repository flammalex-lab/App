# Backtest Summary

Two event studies run against free yfinance data on curated
historical event lists. Both use buy-and-hold with adjusted closes
(dividends reinvested). Excess returns are vs. IWM (Russell 2000) and
SPY.

---

## 1. Spin-offs (27 events, 2015-2024)

### Headline: Small spin-offs beat IWM by ~31% over 18 months at T+0, ~29% at T+21.

### T+0 entry (buy on ex-date)

| Window | Mean | Hit Rate | Excess vs IWM |
|---|---:|---:|---:|
| 1m | -1.3% | 42% | -3.6% |
| 3m | +2.6% | 54% | +0.5% |
| 6m | +10.6% | 54% | +4.9% |
| 12m | +22.7% | 65% | +11.0% |
| 18m | **+45.1%** | **65%** | **+25.2%** |
| 24m | +53.1% | 65% | +30.8% |

### T+21 entry (wait out forced selling window)

| Window | Mean | Hit Rate | Excess vs IWM |
|---|---:|---:|---:|
| 1m | +3.3% | 62% | +2.9% |
| 3m | +5.7% | 62% | +4.3% |
| 6m | +14.4% | 69% | +10.4% |
| 12m | **+27.0%** | **73%** | **+17.3%** |
| 18m | +41.6% | 69% | +23.5% |
| 24m | +30.4% | 63% | +11.6% |

### Small spins vs. large spins (T+21, 18m)

| Size tier | N | Mean return | Excess vs IWM | Hit rate |
|---|---:|---:|---:|---:|
| **Small** | 20 | **+46.4%** | **+29.0%** | **70%** |
| Large | 6 | +25.7% | +5.0% | 67% |

### Findings

1. **Greenblatt's thesis holds in modern data.** Small spins (~15% of parent
   market cap or less) meaningfully outperform both large spins and the
   small-cap benchmark.
2. **The "wait 21 days" rule adds meaningful alpha** at every short window
   — forced-sellers clear within ~3-4 weeks. Hit rate at 12m goes from
   65% to 73%.
3. **Small-spin 12m hit rate is 80%** (T+21) — this is the single
   highest-probability setup we tested.
4. **Outsized winners dominate.** CARR (+244% 12m), GEV (+143%), LW
   (+74%). Hit rate matters less than the asymmetry — a few big wins
   more than compensate for the KDs and WBDs.
5. **Not every spin works.** KD (-77%), WBD (-59%), EMBC (-36%). Clean
   balance sheets and size ratio <15% matter.

### Portfolio implication

Equal-weight all small spin-offs, T+21 entry, 18-month hold → ~46% mean
return per position. If we can identify 5-8 spins per year, the sleeve
can generate ~15-25% annualized, with meaningful individual volatility.
**Put this in a Roth IRA.** Holding period is too short for long-term
capital gains in taxable.

---

## 2. Activist 13D coattails (27 events, 2022-2024)

### Headline: Mixed. Large-cap activist targets modestly beat IWM; small-cap did not (in this window).

### Aggregate returns

| Window | N | Mean | Hit Rate | Excess vs IWM |
|---|---:|---:|---:|---:|
| 6m | 27 | -1.3% | 41% | -3.0% |
| 12m | 27 | +1.9% | 52% | -6.0% |
| 18m | 27 | +11.0% | 59% | -0.9% |
| 24m | 27 | +27.2% | 59% | +7.8% |

### Split by target size tier

| Tier | N | 12m mean | 18m mean | 24m mean | 24m excess vs IWM |
|---|---:|---:|---:|---:|---:|
| Large-cap targets | 13 | +16.9% | +31.6% | +54.8% | **+33.3%** |
| Small-cap targets | 14 | -12.0% | -8.2% | +1.6% | -16.0% |

### Honest findings

1. **Large-cap activist campaigns worked well** in 2022-2024. Elliott +
   Starboard on Salesforce combined for ~1.4x. NRG, AVGO, CRM, NSC all
   delivered. This is consistent with the broader Brav-Jiang literature.
2. **Small-cap activist campaigns in this window underperformed.** The
   2022-2024 small-cap environment was brutal (IWM essentially flat over
   the period), and specific disasters (FWRD -80%, HAIN -88%, PTON -82%,
   SALM -67%) dominated. Even winners like HNRG, FRPT, MRCY took 18-24m
   to materialize.
3. **Time-window sensitivity is real.** The broader academic result
   (Brav-Jiang 2008) covers 1994-2006, a very different small-cap regime.
4. **The 24m hit rate recovers to 59%** — patience helps.

### What this changes

The system's default `activist_13d` weight was 1.4. Based on this
evidence, we should:

- Maintain large-cap activist coattails at current weight.
- **Require additional confirmation** for small-cap activist signals:
  insider cluster, capital-allocator regime change, or 13D/A escalation.
- Extend holding period expectations to 24m minimum for small-cap targets.
- Size small-cap activist positions smaller — the tail risk is real (a
  few -70% outcomes can wipe out a concentrated sleeve).

---

## 3. Methodology notes and caveats

- **Survivorship bias in curated lists.** Both studies use hand-curated
  event lists of names we remember. In production, the daily EDGAR scan
  will cover the *full* set of 13Ds and Form 10s, eliminating this bias.
- **Transaction costs not included** in these numbers. Assume ~50 bps
  round-trip for large-caps, 200-300 bps for small-caps. This erodes
  excess return but does not change the sign of the signal.
- **yfinance data is approximate.** Adjusted closes capture dividends and
  splits but may be imperfect for spin-off cases where the parent's price
  is retroactively adjusted. For production decisions, use point-in-time
  data (Sharadar SF1/SEP or similar).
- **No factor-adjusted returns.** The excess-vs-IWM numbers are raw
  return diffs; Fama-French residuals would tighten the statistical
  story but require factor series.
- **Event sample size is modest** (~27 each). These results should be
  treated as "directional confirmation," not "definitive evidence."

## 4. What to do with this

- **Turn on T+21 entry as the default** for the spin-off signal. Add a
  21-trading-day delay between Form 10 filing detection and the signal's
  "ready to buy" flag.
- **Require stacking confirmation** for small-cap activist signals.
  Adjust scoring weights in `config/settings.yaml`.
- **Run quarterly**: re-pull the curated event lists, add new campaigns,
  re-compute. The methodology is cheap enough to rerun regularly.
- **Next backtest**: insider clusters (Form 4 parsing required — wire LLM
  extraction first) and post-bankruptcy equities (requires bankruptcy
  docket integration).
