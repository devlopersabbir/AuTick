import { describe, it, expect } from 'bun:test';
import { isValidCandle, validateAndSortCandles } from '@/lib/market-data/validation';
import { BybitMarketDataProvider } from '@/lib/market-data/providers/bybit';
import { TwelveDataMarketDataProvider } from '@/lib/market-data/providers/twelvedata';

describe('Market Data Validation and Normalization', () => {
  it('validates a normal candle correctly', () => {
    const valid = {
      timestamp: 1700000000,
      open: 2650.5,
      high: 2655.0,
      low: 2649.0,
      close: 2652.1,
      volume: 120.5,
    };
    expect(isValidCandle(valid)).toBe(true);
  });

  it('rejects invalid OHLC values', () => {
    // high < low
    expect(
      isValidCandle({
        timestamp: 1700000000,
        open: 2650,
        high: 2640,
        low: 2645,
        close: 2642,
      })
    ).toBe(false);

    // low > open
    expect(
      isValidCandle({
        timestamp: 1700000000,
        open: 2640,
        high: 2650,
        low: 2645,
        close: 2648,
      })
    ).toBe(false);

    // high < close
    expect(
      isValidCandle({
        timestamp: 1700000000,
        open: 2640,
        high: 2648,
        low: 2635,
        close: 2650,
      })
    ).toBe(false);

    // negative or zero prices
    expect(
      isValidCandle({
        timestamp: 1700000000,
        open: -10,
        high: 20,
        low: -15,
        close: 10,
      })
    ).toBe(false);

    // NaN or non-number
    expect(
      isValidCandle({
        timestamp: 1700000000,
        open: NaN,
        high: 2650,
        low: 2640,
        close: 2645,
      })
    ).toBe(false);
  });

  it('deduplicates candles with duplicate timestamps and sorts chronologically', () => {
    const raw = [
      { timestamp: 1700000120, open: 2652, high: 2655, low: 2650, close: 2654 },
      { timestamp: 1700000000, open: 2650, high: 2653, low: 2648, close: 2651 },
      // Duplicate of timestamp 1700000000 (updated)
      { timestamp: 1700000000, open: 2650, high: 2654, low: 2648, close: 2652 },
      { timestamp: 1700000060, open: 2651, high: 2653, low: 2649, close: 2650 },
    ];

    const result = validateAndSortCandles(raw);

    // Should have exactly 3 unique timestamps: 1700000000, 1700000060, 1700000120
    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBe(1700000000);
    expect(result[0].close).toBe(2652); // kept latest duplicate
    expect(result[1].timestamp).toBe(1700000060);
    expect(result[2].timestamp).toBe(1700000120);
  });

  it('filters out corrupted candles from a mixed array', () => {
    const raw = [
      { timestamp: 1700000000, open: 2650, high: 2655, low: 2648, close: 2652 },
      { timestamp: 1700000060, open: null, high: 2655, low: 2648, close: 2652 }, // corrupt
      { timestamp: -5, open: 2650, high: 2655, low: 2648, close: 2652 }, // corrupt
      { timestamp: 1700000120, open: 2652, high: 2654, low: 2650, close: 2653 },
    ];

    const result = validateAndSortCandles(raw);
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe(1700000000);
    expect(result[1].timestamp).toBe(1700000120);
  });

  it('rejects invalid date range in providers', async () => {
    const bybit = new BybitMarketDataProvider();
    // startTime >= endTime
    await expect(
      bybit.fetchCandles({
        symbol: 'XAUUSD',
        startTime: 1700000100,
        endTime: 1700000000,
      })
    ).rejects.toThrow('Invalid date range');
  });

  it('handles Twelve Data missing API key with helpful configuration error', async () => {
    const originalKey = process.env.TWELVE_DATA_API_KEY;
    delete process.env.TWELVE_DATA_API_KEY;

    const td = new TwelveDataMarketDataProvider();
    await expect(
      td.fetchCandles({
        symbol: 'XAUUSD',
        startTime: 1700000000,
        endTime: 1700000060,
      })
    ).rejects.toThrow('TWELVE_DATA_API_KEY');

    if (originalKey) {
      process.env.TWELVE_DATA_API_KEY = originalKey;
    }
  });

  it('handles empty provider responses safely without fabricating prices', () => {
    const emptyResult = validateAndSortCandles([]);
    expect(emptyResult).toEqual([]);
  });
});
