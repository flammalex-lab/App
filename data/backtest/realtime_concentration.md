# Honest Walk-Forward Concentration Backtest

**No look-ahead bias.** Events processed in chronological
order. Each rule sees only data observable at filing time.
Capital recycles as 18-month positions close.

All numbers assume 50bps round-trip costs.

## Comparison

| rule                                             |   starting |      ending |   cagr |   total_return |   n_taken |   n_closed |   win_rate |   biggest_winner |   biggest_loser |   rule_failed |   portfolio_full |
|:-------------------------------------------------|-----------:|------------:|-------:|---------------:|----------:|-----------:|-----------:|-----------------:|----------------:|--------------:|-----------------:|
| nano + small only, max 5 concurrent              |     100000 | 3.49738e+06 |  0.452 |         33.974 |        31 |         31 |      0.516 |            5.999 |          -0.672 |            51 |               30 |
| nano + small only, max 8 concurrent              |     100000 | 1.06121e+06 |  0.281 |          9.612 |        45 |         45 |      0.511 |            5.999 |          -0.803 |            51 |               16 |
| nano + small only, max 10 concurrent             |     100000 | 1.02101e+06 |  0.276 |          9.21  |        51 |         51 |      0.549 |            6.509 |          -0.803 |            51 |               10 |
| threshold quality>=0.70 (small + nano), max 5    |     100000 | 3.49738e+06 |  0.452 |         33.974 |        31 |         31 |      0.516 |            5.999 |          -0.672 |            51 |               30 |
| threshold quality>=0.70, max 5, displace weakest |     100000 | 1.62516e+06 |  0.34  |         15.252 |        37 |         37 |      0.568 |            6.509 |          -0.424 |            51 |               24 |
| ALL events, max 10 concurrent                    |     100000 | 1.15996e+06 |  0.293 |         10.6   |        62 |         62 |      0.532 |            5.999 |          -0.999 |             0 |               50 |
| ALL events, max 5 concurrent                     |     100000 | 2.26907e+06 |  0.387 |         21.691 |        32 |         32 |      0.594 |            5.999 |          -0.978 |             0 |               80 |

## Honest comparison vs the earlier (biased) result

Earlier 'top 5 per year by smallest mcap' showed +44.1% CAGR.
That used year-end information to pick the 5 smallest of the
year — small look-ahead bias.

These rules use only filing-time data. The CAGR drop tells you
how much the look-ahead bias inflated the previous result.

## Notes
- 'rule_failed' = events the rule rejected (not eligible)
- 'portfolio_full' = events that qualified but the portfolio
  was already at max concurrent positions
- 'displace_weakest' = whether new high-quality events can
  bump existing weaker positions
- 'win_rate' is on closed positions only