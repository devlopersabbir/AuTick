import type { Candle } from '@/types';

export type FairValueGapDirection = 'bullish' | 'bearish';
export type FairValueGapStatus =
  | 'active'
  | 'touched'
  | 'partially-filled'
  | 'fully-filled'
  | 'invalidated'
  | 'expired';

export interface FairValueGapConfig {
  extensionCandles: number;
  minGapFilterEnabled: boolean;
  minGapAtrMultiplier: number;
  invalidationEnabled: boolean;
  expiryEnabled: boolean;
  expiryCandles: number;
  showFilledZones: boolean;
}

export interface FairValueGap {
  id: string;
  direction: FairValueGapDirection;
  lowerBoundary: number;
  upperBoundary: number;
  gapSize: number;
  startTime: number;
  candleIndex: number;
  status: FairValueGapStatus;
}

export const DEFAULT_FAIR_VALUE_GAP_CONFIG: FairValueGapConfig = {
  extensionCandles: 50,
  minGapFilterEnabled: false,
  minGapAtrMultiplier: 0.25,
  invalidationEnabled: true,
  expiryEnabled: false,
  expiryCandles: 100,
  showFilledZones: true,
};

export function normalizeFairValueGapConfig(
  config: Partial<FairValueGapConfig>,
): FairValueGapConfig {
  const normalized = { ...DEFAULT_FAIR_VALUE_GAP_CONFIG };

  if (Number.isFinite(config.extensionCandles)) {
    normalized.extensionCandles = Math.max(1, Math.min(1000, Math.round(config.extensionCandles!)));
  }
  if (typeof config.minGapFilterEnabled === 'boolean') {
    normalized.minGapFilterEnabled = config.minGapFilterEnabled;
  }
  if (Number.isFinite(config.minGapAtrMultiplier)) {
    normalized.minGapAtrMultiplier = Math.max(0, Math.min(10, config.minGapAtrMultiplier!));
  }
  if (typeof config.invalidationEnabled === 'boolean') {
    normalized.invalidationEnabled = config.invalidationEnabled;
  }
  if (typeof config.expiryEnabled === 'boolean') normalized.expiryEnabled = config.expiryEnabled;
  if (Number.isFinite(config.expiryCandles)) {
    normalized.expiryCandles = Math.max(1, Math.min(10000, Math.round(config.expiryCandles!)));
  }
  if (typeof config.showFilledZones === 'boolean') {
    normalized.showFilledZones = config.showFilledZones;
  }

  return normalized;
}

export function isUsableFvgCandle(candle: Candle | undefined): candle is Candle {
  if (!candle) return false;
  const values = [candle.timestamp, candle.open, candle.high, candle.low, candle.close];
  return values.every(Number.isFinite) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close;
}

function calculateAtr(candles: Candle[], endIndex: number, period: number): number | null {
  const firstIndex = endIndex - period + 1;
  if (firstIndex < 1) return null;

  let total = 0;
  for (let index = firstIndex; index <= endIndex; index++) {
    const candle = candles[index];
    const previous = candles[index - 1];
    if (!isUsableFvgCandle(candle) || !isUsableFvgCandle(previous)) return null;
    total += Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previous.close),
      Math.abs(candle.low - previous.close),
    );
  }
  return total / period;
}

export function detectFairValueGaps(
  candles: Candle[],
  confirmedIndex: number,
  atrPeriod: number,
  requestedConfig: Partial<FairValueGapConfig> = {},
): FairValueGap[] {
  if (!Number.isFinite(confirmedIndex) || confirmedIndex < 2 || candles.length < 3) return [];
  const config = normalizeFairValueGapConfig(requestedConfig);
  const period = Number.isFinite(atrPeriod) ? Math.max(1, Math.floor(atrPeriod)) : 14;
  const confirmedCandles = candles.slice(0, Math.min(Math.floor(confirmedIndex) + 1, candles.length));
  const gaps: FairValueGap[] = [];
  const identifiers = new Set<string>();

  for (let index = 2; index < confirmedCandles.length; index++) {
    const first = confirmedCandles[index - 2];
    const middle = confirmedCandles[index - 1];
    const third = confirmedCandles[index];
    if (!isUsableFvgCandle(first) || !isUsableFvgCandle(middle) || !isUsableFvgCandle(third)) continue;
    if (first.timestamp >= middle.timestamp || middle.timestamp >= third.timestamp) continue;

    let direction: FairValueGapDirection | null = null;
    let lowerBoundary = 0;
    let upperBoundary = 0;
    if (third.low > first.high) {
      direction = 'bullish';
      lowerBoundary = first.high;
      upperBoundary = third.low;
    } else if (third.high < first.low) {
      direction = 'bearish';
      lowerBoundary = third.high;
      upperBoundary = first.low;
    }
    if (!direction) continue;

    const gapSize = upperBoundary - lowerBoundary;
    if (config.minGapFilterEnabled) {
      const atr = calculateAtr(confirmedCandles, index, period);
      if (atr === null || atr <= 0 || gapSize / atr < config.minGapAtrMultiplier) continue;
    }

    const id = `${third.timestamp}:${direction}:${lowerBoundary}:${upperBoundary}`;
    if (identifiers.has(id)) continue;
    identifiers.add(id);

    const gap: FairValueGap = {
      id,
      direction,
      lowerBoundary,
      upperBoundary,
      gapSize,
      startTime: third.timestamp,
      candleIndex: index,
      status: 'active',
    };

    gaps.push(gap);
  }

  return gaps;
}
