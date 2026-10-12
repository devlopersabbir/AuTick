import { describe, expect, it } from 'bun:test';
import type { Candle } from '@/types';
import {
  DEFAULT_FAIR_VALUE_GAP_CONFIG,
} from '@/lib/market-data/fair-value-gap';
import {
  calculateFairValueGaps,
  getLastConfirmedCandleIndex,
} from '@/lib/market-data/fair-value-gap-lifecycle';

function candle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return { timestamp, open, high, low, close };
}

function bullishSetup(): Candle[] {
  return [
    candle(0, 99.5, 100, 99, 99.5),
    candle(60, 100, 101, 99.5, 100.5),
    candle(120, 102.5, 103, 102, 102.5),
  ];
}

function bearishSetup(): Candle[] {
  return [
    candle(0, 100.5, 101, 100, 100.5),
    candle(60, 100, 100.5, 99, 99.5),
    candle(120, 97.5, 98, 97, 97.5),
  ];
}

describe('Fair Value Gap indicator', () => {
  it('detects bullish gaps with exact boundaries and a stable identifier', () => {
    const gaps = calculateFairValueGaps(bullishSetup(), 2, 14);

    expect(gaps).toEqual([
      expect.objectContaining({
        id: '120:bullish:100:102',
        direction: 'bullish',
        lowerBoundary: 100,
        upperBoundary: 102,
        gapSize: 2,
        startTime: 120,
        status: 'active',
      }),
    ]);
  });

  it('detects bearish gaps with exact boundaries', () => {
    const gaps = calculateFairValueGaps(bearishSetup(), 2, 14);
    expect(gaps).toEqual([
      expect.objectContaining({
        direction: 'bearish',
        lowerBoundary: 98,
        upperBoundary: 100,
        gapSize: 2,
      }),
    ]);
  });

  it('applies the optional minimum ATR gap filter and accepts all gaps by default', () => {
    const candles = bullishSetup();
    const baseline = calculateFairValueGaps(candles, 2, 2);

    expect(baseline).toHaveLength(1);
    expect(calculateFairValueGaps(candles, 2, 2, {
      minGapFilterEnabled: true,
      minGapAtrMultiplier: 10,
    })).toEqual([]);
    expect(calculateFairValueGaps(candles, 2, 2, {
      minGapFilterEnabled: true,
      minGapAtrMultiplier: 0.1,
    })).toHaveLength(1);
  });

  it('shows a zone only when a same-time, same-direction breakout qualifies it', () => {
    const candles = bullishSetup();
    expect(calculateFairValueGaps(candles, 2, 14, {}, [])).toEqual([]);
    expect(calculateFairValueGaps(candles, 2, 14, {}, [
      { time: 120, direction: 'bearish' },
    ])).toEqual([]);
    expect(calculateFairValueGaps(candles, 2, 14, {}, [
      { time: 120, direction: 'bullish' },
    ])).toHaveLength(1);
  });

  it('tracks active, touched, partial, full-fill, invalidation, and expiry states', () => {
    const touched = [...bullishSetup(), candle(180, 102, 102.5, 102, 102.2)];
    const partial = [...bullishSetup(), candle(180, 102, 102.5, 101, 101.5)];
    const full = [...bullishSetup(), candle(180, 101, 101.5, 99.5, 100.5)];
    const invalidated = [...bullishSetup(), candle(180, 100, 100.5, 99, 99.5)];
    const expired = [...bullishSetup(), candle(180, 103, 104, 102.5, 103.5), candle(240, 103, 104, 102.5, 103.5)];

    expect(calculateFairValueGaps(bullishSetup(), 2, 14)[0].status).toBe('active');
    expect(calculateFairValueGaps(touched, 3, 14)[0].status).toBe('touched');
    expect(calculateFairValueGaps(partial, 3, 14)[0].status).toBe('partially-filled');
    expect(calculateFairValueGaps(full, 3, 14)[0].status).toBe('fully-filled');
    expect(calculateFairValueGaps(invalidated, 3, 14)[0].status).toBe('invalidated');
    expect(calculateFairValueGaps(invalidated, 3, 14, {
      invalidationEnabled: false,
    })[0].status).toBe('fully-filled');
    expect(calculateFairValueGaps(expired, 4, 14, {
      expiryEnabled: true,
      expiryCandles: 1,
    })[0].status).toBe('expired');

    const bearishTouched = [...bearishSetup(), candle(180, 98, 98, 97.5, 97.8)];
    const bearishPartial = [...bearishSetup(), candle(180, 98.5, 99, 98, 98.5)];
    const bearishFull = [...bearishSetup(), candle(180, 99, 100, 98.5, 99.5)];
    const bearishInvalid = [...bearishSetup(), candle(180, 100, 101, 99.5, 100.5)];
    expect(calculateFairValueGaps(bearishTouched, 3, 14)[0].status).toBe('touched');
    expect(calculateFairValueGaps(bearishPartial, 3, 14)[0].status).toBe('partially-filled');
    expect(calculateFairValueGaps(bearishFull, 3, 14)[0].status).toBe('fully-filled');
    expect(calculateFairValueGaps(bearishInvalid, 3, 14)[0].status).toBe('invalidated');
    expect(calculateFairValueGaps(bearishInvalid, 3, 14, {
      invalidationEnabled: false,
    })[0].status).toBe('fully-filled');
  });

  it('keeps fill progress monotonic and can hide fully filled zones', () => {
    const candles = [
      ...bullishSetup(),
      candle(180, 102, 102.5, 101, 101.5),
      candle(240, 103, 104, 102.5, 103.5),
    ];

    expect(calculateFairValueGaps(candles, 4, 14)[0].status).toBe('partially-filled');
    expect(calculateFairValueGaps([...bullishSetup(), candle(180, 101, 101.5, 99.5, 100.5)], 3, 14, {
      showFilledZones: false,
    })).toEqual([]);
  });

  it('confirms only closed third candles and updates lifecycle from available replay candles only', () => {
    const candles = [...bullishSetup(), candle(180, 102, 102.5, 101, 101.5)];
    expect(calculateFairValueGaps(candles, 1, 14)).toEqual([]);
    expect(calculateFairValueGaps(candles, 2, 14)[0].status).toBe('active');
    expect(calculateFairValueGaps(candles, 3, 14)[0].status).toBe('partially-filled');

    const appendedFuture = [...candles, candle(240, 99, 100, 98, 98.5)];
    expect(calculateFairValueGaps(appendedFuture, 2, 14))
      .toEqual(calculateFairValueGaps(bullishSetup(), 2, 14));
  });

  it('uses the current replay candle but excludes the newest live candle', () => {
    const candles = [...bullishSetup(), candle(180, 102, 102.5, 101, 101.5)];
    expect(getLastConfirmedCandleIndex(candles, 3, false)).toBe(3);
    expect(getLastConfirmedCandleIndex(candles, 3, true)).toBe(2);
    expect(calculateFairValueGaps(candles, 2, 14)[0].startTime).toBe(120);
  });

  it('safely ignores malformed candles, zero ATR, and insufficient history', () => {
    const malformed = bullishSetup();
    malformed[1] = candle(60, 100, 98, 99, 100);
    expect(calculateFairValueGaps(malformed, 2, 2)).toEqual([]);
    expect(calculateFairValueGaps(bullishSetup().slice(0, 2), 1, 14)).toEqual([]);
    expect(calculateFairValueGaps(bullishSetup(), 2, 2, {
      minGapFilterEnabled: true,
      minGapAtrMultiplier: 0,
    })).toHaveLength(1);
    expect(calculateFairValueGaps(bullishSetup(), 2, 14, {
      minGapFilterEnabled: true,
      minGapAtrMultiplier: 0,
    })).toEqual([]);
  });

  it('normalizes zone settings and produces deterministic IDs across repeated replay calculations', () => {
    const candles = bullishSetup();
    const options = {
      ...DEFAULT_FAIR_VALUE_GAP_CONFIG,
      extensionCandles: 0,
      expiryCandles: 0,
    };
    const first = calculateFairValueGaps(candles, 2, 14, options);
    const replay = calculateFairValueGaps(candles, 2, 14, options);

    expect(first).toEqual(replay);
    expect(first[0].id).toBe(replay[0].id);
  });
});
