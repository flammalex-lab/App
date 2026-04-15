# Walk-Forward System Backtest — 2023-01-01 to 2023-06-30

This test replays the EDGAR filing stream as it was available at
each point in time. No curated lists, no hindsight selection.

## Spin-off pipeline (Form 10-12B)

### Coverage

| metric                 |   value |
|:-----------------------|--------:|
| N filings flagged      |    10   |
| N with resolved ticker |     9   |
| N with price data      |     9   |
| Pct tradeable          |     0.9 |

### Returns (tradeable events only)

| window   |   n |   mean_gross |   mean_net_of_costs |   median |   hit_rate_pos |   excess_vs_IWM_mean |   excess_vs_IWM_median |   excess_vs_IWM_hit |   excess_vs_SPY_mean |     p25 |    p75 |
|:---------|----:|-------------:|--------------------:|---------:|---------------:|---------------------:|-----------------------:|--------------------:|---------------------:|--------:|-------:|
| 1m       |   9 |       0.1553 |              0.1503 |   0.0296 |         0.6667 |               0.1367 |                 0.0091 |              0.5556 |               0.1294 | -0.0699 | 0.0431 |
| 3m       |   9 |      -0.061  |             -0.066  |  -0.0264 |         0.4444 |              -0.0854 |                -0.0205 |              0.4444 |              -0.1057 | -0.1102 | 0.0296 |
| 6m       |   9 |      -0.0404 |             -0.0454 |  -0.0371 |         0.4444 |              -0.0602 |                -0.0512 |              0.4444 |              -0.12   | -0.312  | 0.1222 |
| 12m      |   9 |       0.0895 |              0.0845 |   0.0231 |         0.5556 |              -0.094  |                -0.1379 |              0.3333 |              -0.1915 | -0.2643 | 0.641  |
| 18m      |   9 |       0.2303 |              0.2253 |   0.1668 |         0.5556 |              -0.035  |                -0.2064 |              0.3333 |              -0.1706 | -0.1959 | 0.9355 |
| 24m      |   9 |       0.0871 |              0.0821 |   0.0621 |         0.5556 |               0.0276 |                -0.0669 |              0.375  |              -0.2209 | -0.5769 | 0.8732 |

### 12-month return distribution

| bucket      |   n |
|:------------|----:|
| <-50%       |   1 |
| -50 to -20% |   2 |
| -20 to 0%   |   1 |
| 0 to 20%    |   1 |
| 20 to 50%   |   1 |
| 50 to 100%  |   2 |
| >100%       |   1 |

### By cohort year

|   year |   n |   mean_12m |   median_12m |   hit_12m |
|-------:|----:|-----------:|-------------:|----------:|
|   2023 |   9 |     0.0895 |       0.0231 |    0.5556 |

### Recall vs curated winner list

- **curated_total**: 27
- **system_flagged_total**: 9
- **both**: 2
- **recall_pct**: 0.074

## Activist 13D pipeline (whitelist only)

## Interpretation

- Coverage rows tell you how many filings survived CIK→ticker
  resolution. Low resolution pct = many companies were later
  renamed/acquired and don't appear in SEC's current-snapshot JSON.
- `mean_net_of_costs` applies a flat 50 bps round-trip cost.
- `excess_vs_IWM_*` is the honest number for a small-cap tilted strategy.
- `return_distribution_12m` shows tail risk: how many positions
  experienced >50% drawdowns.