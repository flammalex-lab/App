# Walk-Forward System Backtest — 2019-01-01 to 2023-12-31

This test replays the EDGAR filing stream as it was available at
each point in time. No curated lists, no hindsight selection.

## Spin-off pipeline (Form 10-12B)

### Coverage

| metric                 |   value |
|:-----------------------|--------:|
| N filings flagged      |  83     |
| N with resolved ticker |  63     |
| N with price data      |  61     |
| Pct tradeable          |   0.735 |

### Returns (tradeable events only)

| window   |   n |   mean_gross |   mean_net_of_costs |   median |   hit_rate_pos |   excess_vs_IWM_mean |   excess_vs_IWM_median |   excess_vs_IWM_hit |   excess_vs_SPY_mean |     p25 |    p75 |
|:---------|----:|-------------:|--------------------:|---------:|---------------:|---------------------:|-----------------------:|--------------------:|---------------------:|--------:|-------:|
| 1m       |  61 |       0.0484 |              0.0434 |   0.0296 |         0.6393 |               0.0287 |                 0.0279 |              0.5902 |               0.031  | -0.0674 | 0.1219 |
| 3m       |  61 |       0.0608 |              0.0558 |   0.0216 |         0.5902 |               0.0131 |                 0.0057 |              0.5082 |               0.0136 | -0.1047 | 0.2641 |
| 6m       |  61 |       0.1048 |              0.0998 |   0.0462 |         0.5574 |               0.0613 |                 0.0295 |              0.5246 |               0.0276 | -0.1531 | 0.2984 |
| 12m      |  59 |       0.1856 |              0.1806 |   0.0835 |         0.5593 |               0.0955 |                -0.0163 |              0.4746 |               0.0254 | -0.2908 | 0.5312 |
| 18m      |  58 |       0.4308 |              0.4258 |   0.0641 |         0.5345 |               0.267  |                -0.0819 |              0.431  |               0.1687 | -0.2589 | 0.6649 |
| 24m      |  58 |       0.585  |              0.58   |   0.1388 |         0.5517 |               0.3575 |                -0.0849 |              0.431  |               0.2077 | -0.3662 | 0.8643 |

### 12-month return distribution

| bucket      |   n |
|:------------|----:|
| <-50%       |   4 |
| -50 to -20% |  16 |
| -20 to 0%   |   6 |
| 0 to 20%    |   9 |
| 20 to 50%   |   8 |
| 50 to 100%  |  10 |
| >100%       |   6 |

### By cohort year

|   year |   n |   mean_12m |   median_12m |   hit_12m |
|-------:|----:|-----------:|-------------:|----------:|
|   2019 |  13 |     0.258  |      -0.1569 |    0.3077 |
|   2020 |   8 |     0.6    |       0.412  |    0.875  |
|   2021 |  11 |     0.057  |       0.0269 |    0.4545 |
|   2022 |  15 |    -0.0065 |       0.0522 |    0.5333 |
|   2023 |  14 |     0.1842 |       0.1191 |    0.6429 |

### Recall vs curated winner list

- **curated_total**: 27
- **system_flagged_total**: 61
- **both**: 16
- **recall_pct**: 0.593

## Activist 13D pipeline (whitelist only)

### Coverage

| metric                 |   value |
|:-----------------------|--------:|
| N filings flagged      |  75     |
| N with resolved ticker |  52     |
| N with price data      |  50     |
| Pct tradeable          |   0.667 |

### Returns (tradeable events only)

| window   |   n |   mean_gross |   mean_net_of_costs |   median |   hit_rate_pos |   excess_vs_IWM_mean |   excess_vs_IWM_median |   excess_vs_IWM_hit |   excess_vs_SPY_mean |     p25 |    p75 |
|:---------|----:|-------------:|--------------------:|---------:|---------------:|---------------------:|-----------------------:|--------------------:|---------------------:|--------:|-------:|
| 1m       |  50 |       0.0324 |              0.0274 |   0.0043 |         0.52   |               0.0324 |                -0.0016 |              0.5    |               0.0232 | -0.0778 | 0.063  |
| 3m       |  50 |       0.0349 |              0.0299 |  -0.031  |         0.44   |               0.0395 |                -0.0233 |              0.42   |               0.0053 | -0.1298 | 0.1129 |
| 6m       |  50 |       0.1795 |              0.1745 |   0.056  |         0.6    |               0.1315 |                 0.0131 |              0.5    |               0.0829 | -0.098  | 0.3292 |
| 12m      |  50 |       0.1384 |              0.1334 |  -0.0299 |         0.5    |               0.0332 |                -0.1839 |              0.38   |              -0.0716 | -0.3353 | 0.305  |
| 18m      |  49 |       0.1246 |              0.1196 |  -0.0173 |         0.449  |              -0.0369 |                -0.2816 |              0.3469 |              -0.1887 | -0.4518 | 0.3217 |
| 24m      |  49 |       0.191  |              0.186  |  -0.0579 |         0.4694 |              -0.0466 |                -0.327  |              0.3265 |              -0.251  | -0.3946 | 0.2845 |

### 12-month return distribution

| bucket      |   n |
|:------------|----:|
| <-50%       |   8 |
| -50 to -20% |   9 |
| -20 to 0%   |   8 |
| 0 to 20%    |  10 |
| 20 to 50%   |   4 |
| 50 to 100%  |   7 |
| >100%       |   4 |

### By cohort year

|   year |   n |   mean_12m |   median_12m |   hit_12m |
|-------:|----:|-----------:|-------------:|----------:|
|   2019 |   5 |    -0.0569 |       0.005  |    0.6    |
|   2020 |   4 |     0.2125 |       0.0423 |    1      |
|   2021 |   2 |    -0.4201 |      -0.4201 |    0      |
|   2022 |  10 |     0.0205 |      -0.1935 |    0.3    |
|   2023 |  29 |     0.241  |       0.053  |    0.5172 |

## Interpretation

- Coverage rows tell you how many filings survived CIK→ticker
  resolution. Low resolution pct = many companies were later
  renamed/acquired and don't appear in SEC's current-snapshot JSON.
- `mean_net_of_costs` applies a flat 50 bps round-trip cost.
- `excess_vs_IWM_*` is the honest number for a small-cap tilted strategy.
- `return_distribution_12m` shows tail risk: how many positions
  experienced >50% drawdowns.