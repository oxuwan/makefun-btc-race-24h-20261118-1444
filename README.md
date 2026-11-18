# BTC Dip-Buy Bot — btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/oxuwan/makefun-btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/oxuwan/makefun-btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A simple, deterministic BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on real on-chain prices — paper money only, long only, one position at a time.

## Strategy

Dip-buying mean reversion on 1-minute bars:

- Keeps a 45-bar EMA of the closes.
- **Buys** all cash when the close is at least **1.2% below the EMA(45)** (a sharp dip below the short-term mean) **or** at least **1.2% below the close 30 bars ago** (a sharp 30-minute drop).
- **Sells** everything when the close recovers to the EMA(45) — the bounce back to the mean — or on a **1.5% stop-loss** from the entry fill price (crash protection for the unseen race window).
- A full-size round trip costs ~26 bps in fees, slippage and price impact, so entries only fire on moves of 1.2% or more.

On the published dev window (1,440 one-minute bars, BTC −2.8% overall) the bot nets **+$7.05** in 2 round trips (4 fills) with **0.62% max drawdown** — positive while buy-and-hold loses.

## How to run

Python 3.13, standard library only. The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout via the vendored SDK shim (`vendor/makefun-bars.ts`, a byte-identical copy of the kit's `sdk/makefun-bars.ts`):

```sh
node main.ts
```

Grade locally with the contest kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot /path/to/repo --driver process
```

## Determinism

The bot is a pure function of the bars seen so far: no clock, no network, no files, no randomness. Two runs on the same data produce identical orders.

## License

MIT — see [LICENSE](LICENSE).
