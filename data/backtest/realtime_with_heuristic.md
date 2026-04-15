# Heuristic Filter Backtest

Adds a quality filter (using free SEC XBRL Company Facts API)
to the chronological walk-forward simulator. Compares hit rate
and CAGR with and without filter.

## Heuristic recommendation distribution

| heuristic_recommendation   |   count |
|:---------------------------|--------:|
| buy                        |     109 |
| pass                       |      88 |

## Strategy comparison (max 5 concurrent, 18m hold)

| rule                                     |   starting |           ending |   cagr |   n_taken |   win_rate |   biggest_loser |   biggest_winner |   rule_failed |   portfolio_full |
|:-----------------------------------------|-----------:|-----------------:|-------:|----------:|-----------:|----------------:|-----------------:|--------------:|-----------------:|
| no filter (size only)                    |     100000 |      3.49738e+06 |  0.452 |        31 |      0.516 |          -0.672 |            5.999 |            51 |               30 |
| heuristic: high_conviction + buy         |     100000 |      3.57791e+06 |  0.455 |        29 |      0.586 |          -0.424 |            5.999 |            61 |               22 |
| heuristic: high_conviction only (strict) |     100000 | 100000           |  0     |         0 |      0     |           0     |            0     |           112 |                0 |
| heuristic: include watch (loose)         |     100000 |      3.57791e+06 |  0.455 |        29 |      0.586 |          -0.424 |            5.999 |            61 |               22 |

## Interpretation

If the heuristic filter increases CAGR vs 'no filter', the
filter adds value by avoiding losers. If win_rate goes up but
CAGR drops slightly, the filter is too aggressive (kicked out
winners along with losers).

The 'biggest_loser' column shows the worst single position the
rule allowed in. Improvements in this column are pure
drawdown-mitigation alpha.