# LLM-Filtered Walk-Forward Backtest

Events: 197 total, 0 LLM-scored.

## Strategy comparison (max 5 concurrent, 18m hold, 50bps costs)

| rule                                    |      ending |   cagr |   n_taken |   win_rate |   biggest_loser |   biggest_winner |   rule_failed |   portfolio_full |
|:----------------------------------------|------------:|-------:|----------:|-----------:|----------------:|-----------------:|--------------:|-----------------:|
| No filter (baseline)                    | 3.49738e+06 |  0.452 |        31 |      0.516 |          -0.672 |            5.999 |            51 |               30 |
| Heuristic only (buy or high_conviction) | 3.57791e+06 |  0.455 |        29 |      0.586 |          -0.424 |            5.999 |            61 |               22 |

## Filter output distributions

### Heuristic

- `buy`: 109
- `pass`: 88

## Interpretation

- If LLM-filtered CAGR > baseline, the LLM added alpha by
  identifying losers the heuristic couldn't.
- Watch `n_taken`: aggressive filtering drops it; if too low,
  the portfolio won't compound even if per-position returns
  are high.
- `biggest_loser` improvements are drawdown-mitigation alpha.
- 'LLM AND heuristic' is the strictest; it's the honest
  stack the production system uses.