import { Candle } from '@/types';

/**
 * Validates an individual candle for mathematical and financial consistency.
 */
export function isValidCandle(candle: unknown): candle is Candle {
  if (!candle || typeof candle !== 'object') {
    return false;
  }

  const c = candle as Partial<Candle>;

  if (
    typeof c.timestamp !== 'number' ||
    !Number.isFinite(c.timestamp) ||
    c.timestamp <= 0
  ) {
    return false;
  }

  if (
    typeof c.open !== 'number' ||
    !Number.isFinite(c.open) ||
    c.open <= 0
  ) {
    return false;
  }

  if (
    typeof c.high !== 'number' ||
    !Number.isFinite(c.high) ||
    c.high <= 0
  ) {
    return false;
  }

  if (
    typeof c.low !== 'number' ||
    !Number.isFinite(c.low) ||
    c.low <= 0
  ) {
    return false;
  }

  if (
    typeof c.close !== 'number' ||
    !Number.isFinite(c.close) ||
    c.close <= 0
  ) {
    return false;
  }

  // Volume is optional, but if present must be non-negative
  if (c.volume !== undefined && (typeof c.volume !== 'number' || !Number.isFinite(c.volume) || c.volume < 0)) {
    return false;
  }

  // Standard OHLC relationship checks
  if (c.high < c.low) return false;
  if (c.high < c.open || c.high < c.close) return false;
  if (c.low > c.open || c.low > c.close) return false;

  return true;
}

/**
 * Normalizes, validates, deduplicates, and sorts candles chronologically.
 * - Filters out invalid or corrupted candles.
 * - Deduplicates candles with identical timestamps, keeping the most recent valid one.
 * - Sorts in strictly ascending order by UTC timestamp.
 */
export function validateAndSortCandles(rawCandles: unknown[]): Candle[] {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
    return [];
  }

  // 1. Filter valid candles and deduplicate by timestamp
  const candleMap = new Map<number, Candle>();

  for (const item of rawCandles) {
    if (isValidCandle(item)) {
      // Normalize timestamp to integer seconds
      const normalized: Candle = {
        timestamp: Math.floor(item.timestamp),
        open: Number(item.open.toFixed(4)),
        high: Number(item.high.toFixed(4)),
        low: Number(item.low.toFixed(4)),
        close: Number(item.close.toFixed(4)),
        volume: item.volume !== undefined ? Number(item.volume.toFixed(4)) : undefined,
      };
      candleMap.set(normalized.timestamp, normalized);
    }
  }

  // 2. Sort chronologically ascending
  return Array.from(candleMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}
