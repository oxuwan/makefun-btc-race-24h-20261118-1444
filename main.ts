// Dip-buying mean-reversion bot for make.fun btc-race-24h-20261118-1444.
//
// Strategy (single asset CBBTC, long only, full size):
//   - Keep a 45-bar EMA of the 1-minute closes.
//   - BUY all cash when the close is at least 1.2% below the EMA(45) (a sharp
//     dip below the short-term mean) OR at least 1.2% below the close 30 bars
//     ago (a sharp 30-minute drop).
//   - SELL everything when the close recovers to the EMA(45) (the bounce back
//     to the mean), or on a 1.5% stop-loss from the entry fill price (crash
//     protection for the unseen race window). After a stop-loss the bot sits
//     out 30 bars instead of re-buying the same falling knife.
//   - A full-size round trip costs ~26 bps in fees, slippage and price impact,
//     so entries only fire on moves of 1.2% or more.
//
// Deterministic: pure function of the bars seen so far, no clock, no network,
// no files, no randomness. Node 22, no dependencies.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const EMA_PERIOD = 45;
const DIP_BPS = 120; // 1.2% below the EMA(45)
const DROP_BARS = 30; // lookback for the sharp-drop entry
const DROP_BPS = 120; // 1.2% drop over DROP_BARS
const STOP_LOSS_BPS = 150; // 1.5% stop-loss from the entry fill price
const MAX_SLIPPAGE_BPS = 10_000;

const closes: bigint[] = []; // closes (raw price units) in batch order
let ema: number | null = null; // current EMA(45) over raw price units
let entryPrice: bigint | null = null; // fill price of the current position
let cooldownUntil = -1; // no entries before this batch seq (after a stop-loss)

await runBars({
  onBatch(state: BarsState, batch): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const alpha = 2 / (EMA_PERIOD + 1);
    ema = ema === null ? Number(close) : Number(close) * alpha + ema * (1 - alpha);

    // Record the fill price of any buy that landed in this batch; the
    // stop-loss is measured from it.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      if (fill.side === 'buy') entryPrice = BigInt(fill.price);
      else entryPrice = null;
    }

    if (state.warmingUp) return [];

    const holding = state.positions.get(SYMBOL);
    if (holding === undefined) {
      // Entry: need a full EMA window and a 30-bar history; never re-enter
      // right after a stop-loss (falling-knife loop).
      if (batch.seq < cooldownUntil) return [];
      if (closes.length <= DROP_BARS || ema === null) return [];
      const dip = Number(close) <= ema * (1 - DIP_BPS / 10_000);
      const drop =
        Number(close) <= Number(closes[closes.length - 1 - DROP_BARS]) * (1 - DROP_BPS / 10_000);
      if (dip || drop) {
        const cash = state.cash;
        if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Exit: bounce back to the mean, or stop-loss.
    if (ema !== null && Number(close) >= ema) {
      entryPrice = null;
      return [{ side: 'sell', symbol: SYMBOL, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    if (entryPrice !== null && close * 10_000n <= entryPrice * BigInt(10_000 - STOP_LOSS_BPS)) {
      entryPrice = null;
      cooldownUntil = batch.seq + 30; // sit out 30 bars after a stop-loss
      return [{ side: 'sell', symbol: SYMBOL, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
