import { describe, it, expect, beforeEach } from 'bun:test';
import { TradingEngine } from '@/lib/trading/trading-engine';
import { calculateGrossPnl } from '@/lib/trading/calculations';
import { Candle } from '@/types';

const baseCandle: Candle = {
  timestamp: 1700000000,
  open: 2650.0,
  high: 2655.0,
  low: 2648.0,
  close: 2652.0,
};

describe('Simulated Paper Trading Engine', () => {
  let engine: TradingEngine;

  beforeEach(() => {
    engine = new TradingEngine(1000); // $1000 initial balance
  });

  it('correctly calculates LONG and SHORT gross P&L', () => {
    // 1 oz of gold entering at 2650 and exiting at 2660
    const longPnl = calculateGrossPnl('LONG', 2650, 2660, 1.0);
    expect(longPnl).toBe(10.0);

    // 2.5 oz of gold entering at 2650 and exiting at 2640
    const shortPnl = calculateGrossPnl('SHORT', 2650, 2640, 2.5);
    expect(shortPnl).toBe(25.0);

    // Losing short trade: entry 2650, exit 2655
    const shortLoss = calculateGrossPnl('SHORT', 2650, 2655, 1.0);
    expect(shortLoss).toBe(-5.0);
  });

  it('opens a LONG position and tracks balance and equity', () => {
    const res = engine.openPosition(
      {
        side: 'LONG',
        quantity: 1.0,
        stopLoss: 2640,
        takeProfit: 2670,
      },
      baseCandle
    );

    expect(res.success).toBe(true);
    expect(engine.getOpenPosition()).toBeDefined();
    expect(engine.getOpenPosition()?.entryPrice).toBe(baseCandle.close); // 2652.0
    expect(engine.getBalance()).toBe(1000);
    expect(engine.getEquity()).toBe(1000);
  });

  it('rejects invalid quantities', () => {
    const zeroRes = engine.openPosition({ side: 'LONG', quantity: 0 }, baseCandle);
    expect(zeroRes.success).toBe(false);

    const negRes = engine.openPosition({ side: 'LONG', quantity: -1.5 }, baseCandle);
    expect(negRes.success).toBe(false);
  });

  it('rejects invalid SL/TP for LONG positions', () => {
    // For LONG at 2652: SL must be < 2652, TP must be > 2652
    const invalidSl = engine.openPosition(
      { side: 'LONG', quantity: 1, stopLoss: 2655 },
      baseCandle
    );
    expect(invalidSl.success).toBe(false);

    const invalidTp = engine.openPosition(
      { side: 'LONG', quantity: 1, takeProfit: 2650 },
      baseCandle
    );
    expect(invalidTp.success).toBe(false);
  });

  it('rejects invalid SL/TP for SHORT positions', () => {
    // For SHORT at 2652: SL must be > 2652, TP must be < 2652
    const invalidSl = engine.openPosition(
      { side: 'SHORT', quantity: 1, stopLoss: 2650 },
      baseCandle
    );
    expect(invalidSl.success).toBe(false);

    const invalidTp = engine.openPosition(
      { side: 'SHORT', quantity: 1, takeProfit: 2655 },
      baseCandle
    );
    expect(invalidTp.success).toBe(false);
  });

  it('disallows opening a second position while one is open', () => {
    engine.openPosition({ side: 'LONG', quantity: 1 }, baseCandle);
    const secondRes = engine.openPosition({ side: 'SHORT', quantity: 1 }, baseCandle);
    expect(secondRes.success).toBe(false);
    expect(secondRes.error).toContain('already exists');
  });

  it('manually closes position at current candle close', () => {
    engine.openPosition({ side: 'LONG', quantity: 2.0 }, baseCandle);

    const exitCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2652,
      high: 2665,
      low: 2650,
      close: 2662, // +10 points gain per unit
    };

    const res = engine.closePosition(exitCandle);
    expect(res.success).toBe(true);
    expect(res.trade?.exitReason).toBe('MANUAL');
    expect(res.trade?.entryPrice).toBe(2652);
    expect(res.trade?.exitPrice).toBe(2662);
    expect(res.trade?.grossPnl).toBe(20); // (2662 - 2652) * 2 = 20

    expect(engine.getOpenPosition()).toBeNull();
    expect(engine.getBalance()).toBe(1020);
    expect(engine.getEquity()).toBe(1020);
    expect(engine.getTradeHistory()).toHaveLength(1);
  });

  it('triggers Stop Loss automatically on subsequent candle', () => {
    engine.openPosition(
      { side: 'LONG', quantity: 1.0, stopLoss: 2645, takeProfit: 2670 },
      baseCandle // close: 2652
    );

    const droppingCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2650,
      high: 2651,
      low: 2642, // hits SL at 2645
      close: 2644,
    };

    const tick = engine.processCandle(droppingCandle);
    expect(tick.closedTrade).toBeDefined();
    expect(tick.closedTrade?.exitReason).toBe('SL');
    expect(tick.closedTrade?.exitPrice).toBe(2645);
    // Loss: (2645 - 2652) * 1 = -7
    expect(tick.closedTrade?.grossPnl).toBe(-7);
    expect(engine.getBalance()).toBe(993);
    expect(engine.getEquity()).toBe(993);
    expect(engine.getOpenPosition()).toBeNull();
  });

  it('triggers Take Profit automatically on subsequent candle', () => {
    engine.openPosition(
      { side: 'SHORT', quantity: 1.0, stopLoss: 2665, takeProfit: 2635 },
      baseCandle // close: 2652
    );

    const droppingCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2650,
      high: 2651,
      low: 2630, // hits TP at 2635
      close: 2633,
    };

    const tick = engine.processCandle(droppingCandle);
    expect(tick.closedTrade).toBeDefined();
    expect(tick.closedTrade?.exitReason).toBe('TP');
    expect(tick.closedTrade?.exitPrice).toBe(2635);
    // Short profit: (2652 - 2635) * 1 = +17
    expect(tick.closedTrade?.grossPnl).toBe(17);
    expect(engine.getBalance()).toBe(1017);
    expect(engine.getEquity()).toBe(1017);
    expect(engine.getOpenPosition()).toBeNull();
  });

  it('handles candle touching both SL and TP conservatively (SL priority)', () => {
    // Extreme volatility candle touches both SL and TP
    engine.openPosition(
      { side: 'LONG', quantity: 1.0, stopLoss: 2640, takeProfit: 2660 },
      baseCandle // close: 2652
    );

    const volatileCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2650,
      high: 2665, // above TP
      low: 2635,  // below SL
      close: 2655,
    };

    const tick = engine.processCandle(volatileCandle);
    expect(tick.closedTrade).toBeDefined();
    // Conservative assumption: SL triggered first
    expect(tick.closedTrade?.exitReason).toBe('SL');
    expect(tick.closedTrade?.exitPrice).toBe(2640);
    expect(tick.closedTrade?.grossPnl).toBe(-12);
    expect(engine.getBalance()).toBe(988);
  });

  it('does not process the same candle twice (prevents duplicate trades/ticks)', () => {
    engine.openPosition(
      { side: 'LONG', quantity: 1.0, stopLoss: 2640 },
      baseCandle
    );

    const nextCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2652,
      high: 2654,
      low: 2651,
      close: 2653,
    };

    engine.processCandle(nextCandle);
    const posBefore = engine.getOpenPosition();

    // Re-processing exact same timestamp should do nothing
    engine.processCandle(nextCandle);
    const posAfter = engine.getOpenPosition();

    expect(posBefore).toEqual(posAfter);
    expect(engine.getTradeHistory()).toHaveLength(0);
  });

  it('keeps position open at end of dataset without silently force-closing', () => {
    engine.openPosition({ side: 'LONG', quantity: 1.0 }, baseCandle);

    const lastCandle: Candle = {
      timestamp: baseCandle.timestamp + 60,
      open: 2652,
      high: 2658,
      low: 2650,
      close: 2656,
    };

    // Process the final candle in the dataset
    engine.processCandle(lastCandle);

    // Position MUST remain open
    expect(engine.getOpenPosition()).not.toBeNull();
    expect(engine.getOpenPosition()?.unrealizedPnl).toBe(4); // 2656 - 2652
    expect(engine.getBalance()).toBe(1000); // realized balance remains 1000
    expect(engine.getEquity()).toBe(1004); // equity includes unrealized P&L
    expect(engine.getTradeHistory()).toHaveLength(0); // not counted as closed trade
  });
});
