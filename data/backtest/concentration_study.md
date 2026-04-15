# Concentration Backtest

Tests whether concentrating to top-N picks per year (by smallest
newco market cap) outperforms wider deployment, on the 2015-2024
walk-forward dataset (n=197 raw, ~119 with size data).

All numbers assume 50bps round-trip costs, 18-month hold, no leverage.

## Per-position summary (mean return per pick)

| strategy           |   n_positions |   mean_per_position |   median_per_position |   hit_rate |   implied_cagr |    p25 |   p75 |   best |   worst |
|:-------------------|--------------:|--------------------:|----------------------:|-----------:|---------------:|-------:|------:|-------:|--------:|
| All flagged events |           112 |               0.433 |                 0.165 |      0.607 |          0.271 | -0.209 | 0.644 |  6.504 |  -1.004 |
| Small + nano only  |            61 |               0.605 |                 0.185 |      0.607 |          0.371 | -0.201 | 0.695 |  6.504 |  -0.808 |
| top_10_per_year    |            88 |               0.475 |                 0.145 |      0.557 |          0.296 | -0.244 | 0.67  |  6.504 |  -0.983 |
| top_8_per_year     |            73 |               0.557 |                 0.168 |      0.589 |          0.343 | -0.235 | 0.695 |  6.504 |  -0.983 |
| top_5_per_year     |            49 |               0.565 |                 0.086 |      0.571 |          0.348 | -0.201 | 0.555 |  6.504 |  -0.677 |
| top_3_per_year     |            29 |               0.597 |                 0.086 |      0.586 |          0.366 | -0.104 | 0.555 |  6.504 |  -0.424 |

## Equity curve simulations (recycled capital)

### sim_top_10_per_year
- Years: 10
- Total return: **3485.6%**
- CAGR: **43.0%**

|   year |   n_positions |   starting_capital |   ending_capital |   cohort_return |
|-------:|--------------:|-------------------:|-----------------:|----------------:|
|   2015 |            10 |   100000           | 134759           |           0.348 |
|   2016 |            10 |   134759           | 192857           |           0.431 |
|   2017 |             5 |   192857           | 170012           |          -0.118 |
|   2018 |            10 |   170012           | 164721           |          -0.031 |
|   2019 |            10 |   164721           | 374971           |           1.276 |
|   2020 |             8 |   374971           | 619445           |           0.652 |
|   2021 |            10 |   619445           | 748756           |           0.209 |
|   2022 |            10 |   748756           | 853469           |           0.14  |
|   2023 |            10 |   853469           |      1.12298e+06 |           0.316 |
|   2024 |             6 |        1.12298e+06 |      3.58563e+06 |           2.193 |

### sim_top_5_per_year
- Years: 10
- Total return: **3756.5%**
- CAGR: **44.1%**

|   year |   n_positions |   starting_capital |   ending_capital |   cohort_return |
|-------:|--------------:|-------------------:|-----------------:|----------------:|
|   2015 |             5 |   100000           | 126675           |           0.267 |
|   2016 |             5 |   126675           | 213866           |           0.688 |
|   2017 |             5 |   213866           | 188533           |          -0.118 |
|   2018 |             5 |   188533           | 224070           |           0.188 |
|   2019 |             5 |   224070           | 579393           |           1.586 |
|   2020 |             5 |   579393           | 600021           |           0.036 |
|   2021 |             5 |   600021           | 728524           |           0.214 |
|   2022 |             5 |   728524           |      1.05712e+06 |           0.451 |
|   2023 |             5 |        1.05712e+06 |      1.26e+06    |           0.192 |
|   2024 |             5 |        1.26e+06    |      3.85653e+06 |           2.061 |

### sim_top_3_per_year
- Years: 10
- Total return: **3777.6%**
- CAGR: **44.2%**

|   year |   n_positions |   starting_capital |   ending_capital |   cohort_return |
|-------:|--------------:|-------------------:|-----------------:|----------------:|
|   2015 |             3 |   100000           | 117457           |           0.175 |
|   2016 |             3 |   117457           | 202403           |           0.723 |
|   2017 |             3 |   202403           | 161940           |          -0.2   |
|   2018 |             3 |   161940           | 265406           |           0.639 |
|   2019 |             3 |   265406           | 815274           |           2.072 |
|   2020 |             3 |   815274           | 768549           |          -0.057 |
|   2021 |             3 |   768549           |      1.22225e+06 |           0.59  |
|   2022 |             3 |        1.22225e+06 |      1.19303e+06 |          -0.024 |
|   2023 |             3 |        1.19303e+06 |      1.61963e+06 |           0.358 |
|   2024 |             3 |        1.61963e+06 |      3.87756e+06 |           1.394 |

## Interpretation

If top-N concentration shows higher per-position mean and
higher CAGR than 'small + nano only', concentration adds
value beyond just the size filter. If not, the size filter
captures all the alpha and you should diversify within it.

**With Kelly sizing layered on**, you'd hold each year's
5-8 picks at 5-10% each (40-50% of portfolio), keep the rest
in T-bills + LEAPS overlays + special situations. Realistic
portfolio CAGR depends on the per-position mean and how aggressively
you Kelly-size.