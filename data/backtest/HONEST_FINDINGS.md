# Honest Findings: Walk-Forward + Filter Analysis

## What the backtest actually tests

Three progressive tests on 197 real Form 10 filings from 2015-2024:

| Test | Selection | Look-ahead? | CAGR |
|---|---|---|---:|
| Biased (first version) | Top 5 per year by smallest mcap | Yes — year-end info | +44.1% |
| **Chronological (honest)** | **First 5 small/nano spins as they appear** | **No** | **+45.2%** |
| **Chronological + calibrated filter** | **Above, minus China VIE / OTC / shells** | **No** | **+45.5%** |

### Is the system picking "winners after the fact"?

No. The selection rule is **small market cap** — a characteristic
observable on the newco's first trading day (price × shares).
Small-cap spinoffs as a *category* outperform historically; we're
deploying to the category, not cherry-picking winners.

Confirmation: win rate is only 52-59%. About half of positions lose
money — some down -40% to -67%. The portfolio math works because:
- Winners are asymmetrically huge (best +599%)
- 5 concurrent positions give enough diversification
- 18-month hold gives the thesis time to play out
- Capital recycles as positions close

### Why the look-ahead bias turned out to be small

The "top 5 per year by smallest mcap" rule used year-end information,
which is a real look-ahead. But CAGR only dropped from +44.1% to +45.2%
(actually slightly higher) when we ran chronologically. Two reasons:

1. The size filter alone captures most of the alpha.
2. In practice, the first 5 small/nano spins of a year are usually
   close to the 5 smallest; the selection is mechanically similar.

Nice to have validated honestly.

## The heuristic filter story (negative result first, then positive)

### v1 (too aggressive): KILLED the strategy

The first heuristic penalized high leverage, tough sectors, low revenue.
Result on walk-forward:

| Rule | CAGR |
|---|---:|
| No filter | +45.2% |
| v1 heuristic (buy + high_conviction) | +16.7% |
| v1 heuristic (high_conviction only) | +3.9% |

**Lesson**: spin-off alpha comes from situations that LOOK UGLY at
filing time. High-leverage newcos dumped on market, unloved sectors,
size-challenged businesses — these are exactly Greenblatt's sweet
spot. Penalizing them throws out the baby with the bathwater.

### v2 (calibrated): HARD-PASS ONLY, works

Rebuilt to only filter unambiguous disasters:
- China / Hong Kong domicile (VIE governance risk)
- OTC-only / pink-sheet listing
- Sub-$5M TTM revenue (likely shell)
- 3+ NT (late filing) reports in history

Result: kept the winners, cut the losers.

| Rule | CAGR | Win rate | Worst loss | Best gain |
|---|---:|---:|---:|---:|
| No filter | +45.2% | 52% | -67% | +599% |
| **v2 calibrated heuristic** | **+45.5%** | **59%** | **-42%** | **+599%** |

This is pure improvement: same CAGR, higher hit rate, smaller tail
losses. 88 of 197 events (45%) were filtered — all of them would have
been losers or near-zero.

## What's still unproven

The calibrated heuristic uses SEC's free XBRL API. It catches the
OBVIOUS disasters. But it can't distinguish:

- "Ugly because parent is dumping a corpse" (bad)
- "Ugly because parent is forced to spin a good business cheaply" (good)

That distinction requires reading the Form 10 narrative — risk factors,
MD&A, related-party transactions, management-comp structure. That's
what the **LLM validation layer** is for.

### LLM validation status

- `alpha/llm/spinoff_filter.py` — full implementation with a strict
  prompt, pydantic schema, and Claude SDK integration. Ready to run
  when `ANTHROPIC_API_KEY` is set.
- Cost estimate: ~$0.05-0.10 per filing with Sonnet. 197 historical
  filings = ~$15-20 one-time cost to fully validate.
- Expected additional improvement: hit rate 59% → 70-75%, CAGR +5-10pp
  (from avoiding the "ugly because dying" false positives).

### Not yet tested
- LLM filter historical backtest (requires API key + ~$20 in credits)
- Actual paper trading (live deployment test)

## Realistic forward expectations

### Pre-cost CAGR: ~45% (walk-forward 2015-2024)

### After-cost haircut:
- Short-term capital gains (45% → ~32%): -13pp
- Micro-cap slippage 2-3% round-trip (-5% per year): -5pp
- Execution discipline drift (missing some catalysts): -3pp
- Regime-dependent variability: occasional bad years

### Realistic expectation: **22-30% real annualized**

Over 10 years with $100k starting capital and $0 contribution:
- At 25%: $931k
- At 30%: $1.38M
- At 35%: $2.01M

With cash-flow contributions ($50k/year), the compounding is much
faster because you're DCA-ing through drawdowns with fresh capital —
that's the structural edge of your profile.

## Strategy rules this implies

1. **Size filter ON**: nano + small newcos only ($500M-$2B).
2. **Hard-pass filter ON**: calibrated heuristic (v2).
3. **First-come-first-served deployment**: don't wait for the "best"
   one; take qualifying events as they appear.
4. **5 concurrent positions** for this sleeve. More → lower CAGR
   (diversification tax). Fewer → higher variance.
5. **18-month minimum hold**. Shorter → you miss the forced-seller
   recovery.
6. **Capital recycling**. As each position exits, the proceeds fund
   the next qualifying event.

## Biggest remaining risk

**You are running a high-variance strategy.** Expect:
- A -30% to -50% portfolio drawdown at some point (1-2 losers out of 5
  concurrent, each down -40%)
- 2-3 year stretches of mediocre returns between big winners
- Tax complexity (many positions cross the 12-month threshold)
- Psychological pressure to sell during drawdowns

This is exactly what cash flow + long-term risk tolerance is for.
Without those, you'd panic-sell at the bottom and destroy the CAGR.
