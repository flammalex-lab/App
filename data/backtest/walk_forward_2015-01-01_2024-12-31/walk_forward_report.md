# Walk-Forward System Backtest — 2015-01-01 to 2024-12-31

This test replays the EDGAR filing stream as it was available at
each point in time. No curated lists, no hindsight selection.

## Spin-off pipeline (Form 10-12B)

### Coverage

| metric                 |   value |
|:-----------------------|--------:|
| N filings flagged      | 197     |
| N with resolved ticker | 128     |
| N with price data      | 122     |
| Pct tradeable          |   0.619 |

### Returns (tradeable events only)

| window   |   n |   mean_gross |   mean_net_of_costs |   median |   hit_rate_pos |   excess_vs_IWM_mean |   excess_vs_IWM_median |   excess_vs_IWM_hit |   excess_vs_SPY_mean |     p25 |    p75 |
|:---------|----:|-------------:|--------------------:|---------:|---------------:|---------------------:|-----------------------:|--------------------:|---------------------:|--------:|-------:|
| 1m       | 122 |       0.0214 |              0.0164 |   0.0188 |         0.582  |               0.0125 |                 0.0041 |              0.541  |               0.0119 | -0.077  | 0.1072 |
| 3m       | 122 |       0.0434 |              0.0384 |   0.0166 |         0.541  |               0.0108 |                 0.0046 |              0.5082 |               0.0069 | -0.112  | 0.1893 |
| 6m       | 122 |       0.0749 |              0.0699 |   0.0222 |         0.5328 |               0.0452 |                 0.0179 |              0.5082 |               0.0108 | -0.1443 | 0.2743 |
| 12m      | 120 |       0.2609 |              0.2559 |   0.1153 |         0.5917 |               0.17   |                 0.0045 |              0.5    |               0.1118 | -0.2333 | 0.4806 |
| 18m      | 112 |       0.4379 |              0.4329 |   0.1703 |         0.6071 |               0.2822 |                -0.064  |              0.4732 |               0.2047 | -0.2044 | 0.6494 |
| 24m      | 106 |       0.4542 |              0.4492 |   0.1513 |         0.5755 |               0.2446 |                -0.0572 |              0.4623 |               0.122  | -0.2512 | 0.7723 |

### 12-month return distribution

| bucket      |   n |
|:------------|----:|
| <-50%       |  10 |
| -50 to -20% |  24 |
| -20 to 0%   |  15 |
| 0 to 20%    |  22 |
| 20 to 50%   |  20 |
| 50 to 100%  |  18 |
| >100%       |  11 |

### By cohort year

|   year |   n |   mean_12m |   median_12m |   hit_12m |
|-------:|----:|-----------:|-------------:|----------:|
|   2015 |  16 |     0.1136 |       0.0904 |    0.5625 |
|   2016 |  15 |     0.3849 |       0.5087 |    0.8    |
|   2017 |   5 |     0.1173 |       0.1171 |    1      |
|   2018 |  13 |    -0.0319 |      -0.0179 |    0.4615 |
|   2019 |  13 |     0.258  |      -0.1569 |    0.3077 |
|   2020 |   8 |     0.6    |       0.412  |    0.875  |
|   2021 |  11 |     0.057  |       0.0269 |    0.4545 |
|   2022 |  15 |    -0.0065 |       0.0522 |    0.5333 |
|   2023 |  14 |     0.1842 |       0.1191 |    0.6429 |
|   2024 |  12 |     1.0493 |       0.0166 |    0.5    |

### Recall vs curated winner list

- **curated_total**: 27
- **system_flagged_total**: 122
- **both**: 23
- **recall_pct**: 0.852

## Activist 13D pipeline (whitelist only)

## Interpretation

- Coverage rows tell you how many filings survived CIK→ticker
  resolution. Low resolution pct = many companies were later
  renamed/acquired and don't appear in SEC's current-snapshot JSON.
- `mean_net_of_costs` applies a flat 50 bps round-trip cost.
- `excess_vs_IWM_*` is the honest number for a small-cap tilted strategy.
- `return_distribution_12m` shows tail risk: how many positions
  experienced >50% drawdowns.