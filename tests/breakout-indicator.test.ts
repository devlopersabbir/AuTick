import { describe, expect, it } from 'bun:test';
import type { Candle } from '@/types';
import {
  calculateBreakoutSignals,
  DEFAULT_BREAKOUT_INDICATOR_CONFIG,
  normalizeBreakoutIndicatorConfig,
} from '@/lib/market-data/breakout-indicator';

function baseCandles(count = 24): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: index * 60,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
  }));
}

function testConfig(overrides: Record<string, number> = {}) {
  return {
    ...DEFAULT_BREAKOUT_INDICATOR_CONFIG,
    breakoutStrengthWeight: 0,
    candleQualityWeight: 1,
    trendWeight: 0,
    momentumWeight: 0,
    wickPenaltyWeight: 0,
    breakoutThreshold: 0,
    probabilityThreshold: 0.5,
    ...overrides,
  };
}

function addBullishBreakout(candles: Candle[]) {
  const timestamp = candles.length * 60;
  candles.push({ timestamp, open: 101, high: 102.5, low: 101, close: 102.5, volume: 1 });
}

function addBearishBreakout(candles: Candle[]) {
  const timestamp = candles.length * 60;
  candles.push({ timestamp, open: 99, high: 99, low: 97.5, close: 97.5, volume: 1 });
}

describe('Mathematical breakout indicator', () => {
  it('marks a bullish resistance close below the candle with an up signal', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);

    expect(calculateBreakoutSignals(candles, 24, 60, 1500, testConfig())).toEqual([
      expect.objectContaining({ time: 1440, direction: 'up', price: 102.5 }),
    ]);
  });

  it('marks a bearish support close above the candle with a down signal', () => {
    const candles = baseCandles();
    addBearishBreakout(candles);

    expect(calculateBreakoutSignals(candles, 24, 60, 1500, testConfig())).toEqual([
      expect.objectContaining({ time: 1440, direction: 'down', price: 97.5 }),
    ]);
  });

  it('never signals before the candle close and includes the signal at its close', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);

    expect(calculateBreakoutSignals(candles, 24, 60, 1499, testConfig())).toEqual([]);
    expect(calculateBreakoutSignals(candles, 24, 60, 1500, testConfig())).toHaveLength(1);
  });

  it('calculates historical replay signals only through the replay index', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);
    addBearishBreakout(candles);

    const bullishReplay = calculateBreakoutSignals(candles, 24, 60, 1560, testConfig());
    const replayThroughBearish = calculateBreakoutSignals(candles, 25, 60, 1560, testConfig());

    expect(bullishReplay.map((signal) => signal.direction)).toEqual(['up']);
    expect(replayThroughBearish.map((signal) => signal.direction)).toEqual(['up', 'down']);
  });

  it('does not repaint old signals when future candles are appended', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);
    const beforeFutureData = calculateBreakoutSignals(candles, 24, 60, 1500, testConfig());
    const withFutureData = [
      ...candles,
      { timestamp: 1500, open: 102, high: 120, low: 90, close: 105, volume: 1 },
    ];

    expect(calculateBreakoutSignals(withFutureData, 24, 60, 1500, testConfig()))
      .toEqual(beforeFutureData);
  });

  it('does not repeat arrows while price remains beyond the same breakout', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);
    candles.push(
      { timestamp: 1500, open: 102.5, high: 103, low: 102, close: 102.8, volume: 1 },
      { timestamp: 1560, open: 102.8, high: 103.2, low: 102.5, close: 103, volume: 1 },
    );

    const signals = calculateBreakoutSignals(candles, 26, 60, 1680, testConfig());
    expect(signals.filter((signal) => signal.direction === 'up')).toHaveLength(1);
  });

  it('allows a new breakout after price closes back through the previous breakout level', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);
    candles.push(
      { timestamp: 1500, open: 100.5, high: 101, low: 100, close: 100.5, volume: 1 },
      { timestamp: 1560, open: 102.5, high: 103.5, low: 102.5, close: 103.5, volume: 1 },
    );

    const signals = calculateBreakoutSignals(candles, 26, 60, 1680, testConfig());
    expect(signals.filter((signal) => signal.direction === 'up').map((signal) => signal.time))
      .toEqual([1440, 1560]);
  });

  it('requires breakout strength and logistic probability to meet their thresholds', () => {
    const candles = baseCandles();
    addBullishBreakout(candles);

    expect(calculateBreakoutSignals(candles, 24, 60, 1500, testConfig({
      breakoutThreshold: 10,
    }))).toEqual([]);
    expect(calculateBreakoutSignals(candles, 24, 60, 1500, testConfig({
      probabilityThreshold: 0.99,
    }))).toEqual([]);
  });

  it('filters weak closes and upper-wick false-breakout candidates with their configured weights', () => {
    const weakClose = baseCandles();
    weakClose.push({ timestamp: 1440, open: 101.5, high: 104, low: 101, close: 101.1, volume: 1 });
    const upperWick = baseCandles();
    upperWick.push({ timestamp: 1440, open: 101, high: 104, low: 100.9, close: 102, volume: 1 });

    expect(calculateBreakoutSignals(weakClose, 24, 60, 1500, testConfig({
      probabilityThreshold: 0.7,
    }))).toEqual([]);
    expect(calculateBreakoutSignals(upperWick, 24, 60, 1500, testConfig({
      candleQualityWeight: 0,
      wickPenaltyWeight: 5,
      probabilityThreshold: 0.6,
    }))).toEqual([]);
  });

  it('safely skips zero-ATR and zero-range data', () => {
    const flat = Array.from({ length: 30 }, (_, index) => ({
      timestamp: index * 60,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 0,
    }));

    expect(calculateBreakoutSignals(flat, 29, 60, 1800)).toEqual([]);
    expect(calculateBreakoutSignals([], 0, 60, 1000)).toEqual([]);
  });

  it('normalizes configurable periods and thresholds into safe ranges', () => {
    expect(normalizeBreakoutIndicatorConfig({
      lookbackPeriod: 0,
      atrPeriod: 10000,
      fastEmaPeriod: 400,
      slowEmaPeriod: 3,
      probabilityThreshold: 1.5,
      breakoutStrengthWeight: -1,
    })).toMatchObject({
      lookbackPeriod: 2,
      atrPeriod: 200,
      fastEmaPeriod: 2,
      slowEmaPeriod: 3,
      probabilityThreshold: 0.99,
      breakoutStrengthWeight: 0,
    });
  });
});
