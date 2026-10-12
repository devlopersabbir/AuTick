import { describe, expect, it } from 'bun:test';
import type { Candle } from '@/types';
import { findClosedCandleBreakouts } from '@/lib/market-data/breakout-indicator';

function createCandles(values: Array<Partial<Candle>>): Candle[] {
  return values.map((value, index) => ({
    timestamp: index * 60,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
    ...value,
  }));
}

describe('Live breakout indicator', () => {
  it('marks a closed candle closing above the previous 20-candle high', () => {
    const candles = createCandles(Array.from({ length: 21 }, (_, index) => (
      index === 20
        ? { high: 105, close: 104 }
        : { high: 102, low: 98, close: index === 19 ? 101 : 100 }
    )));

    expect(findClosedCandleBreakouts(candles, 20, 60, 1260)).toEqual([
      { time: 1200, direction: 'up', price: 104 },
    ]);
  });

  it('marks a closed candle closing below the previous 20-candle low', () => {
    const candles = createCandles(Array.from({ length: 21 }, (_, index) => (
      index === 20
        ? { low: 95, close: 96 }
        : { high: 102, low: 98, close: index === 19 ? 99 : 100 }
    )));

    expect(findClosedCandleBreakouts(candles, 20, 60, 1260)).toEqual([
      { time: 1200, direction: 'down', price: 96 },
    ]);
  });

  it('requires a close outside the range, a crossing from inside, and a completed candle', () => {
    const candles = createCandles(Array.from({ length: 22 }, (_, index) => (
      index === 20
        ? { high: 110, close: 102 }
        : index === 21
          ? { high: 111, close: 103 }
          : { high: 102, low: 98, close: index === 19 ? 103 : 100 }
    )));

    expect(findClosedCandleBreakouts(candles, 21, 60, 1320)).toEqual([]);
    expect(findClosedCandleBreakouts(candles, 21, 60, 1321)).toEqual([]);
  });

  it('respects the available replay/current index and needs the full lookback', () => {
    const candles = createCandles(Array.from({ length: 21 }, (_, index) => (
      index === 20 ? { close: 105, high: 106 } : { high: 102, low: 98 }
    )));

    expect(findClosedCandleBreakouts(candles, 19, 60, 1260)).toEqual([]);
    expect(findClosedCandleBreakouts(candles.slice(0, 20), 20, 60, 1260)).toEqual([]);
  });
});
