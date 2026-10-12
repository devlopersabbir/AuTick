import type { Candle } from '@/types';
import {
  detectFairValueGaps,
  isUsableFvgCandle,
  normalizeFairValueGapConfig,
  type FairValueGap,
  type FairValueGapConfig,
  type FairValueGapStatus,
} from './fair-value-gap';

export interface FairValueGapQualification {
  time: number;
  direction: 'bullish' | 'bearish';
}

export function getLastConfirmedCandleIndex(
  candles: Candle[],
  currentIndex: number,
  isLiveMode: boolean,
): number {
  const lastVisibleIndex = Math.min(Math.floor(currentIndex), candles.length - 1);
  if (lastVisibleIndex < 0) return -1;
  return isLiveMode ? lastVisibleIndex - 1 : lastVisibleIndex;
}

function updateStatus(
  gap: FairValueGap,
  candle: Candle,
  age: number,
  config: FairValueGapConfig,
): FairValueGapStatus {
  if (config.expiryEnabled && age > config.expiryCandles) return 'expired';

  let observedStatus: FairValueGapStatus = 'active';
  if (gap.direction === 'bullish') {
    if (config.invalidationEnabled && candle.close < gap.lowerBoundary) return 'invalidated';
    if (candle.low <= gap.lowerBoundary) return 'fully-filled';
    if (candle.low < gap.upperBoundary) observedStatus = 'partially-filled';
    else if (candle.low <= gap.upperBoundary && candle.high >= gap.lowerBoundary) {
      observedStatus = 'touched';
    }
  } else {
    if (config.invalidationEnabled && candle.close > gap.upperBoundary) return 'invalidated';
    if (candle.high >= gap.upperBoundary) return 'fully-filled';
    if (candle.high > gap.lowerBoundary) observedStatus = 'partially-filled';
    else if (candle.high >= gap.lowerBoundary && candle.low <= gap.upperBoundary) {
      observedStatus = 'touched';
    }
  }

  const progress: Record<FairValueGapStatus, number> = {
    active: 0,
    touched: 1,
    'partially-filled': 2,
    'fully-filled': 3,
    invalidated: 3,
    expired: 3,
  };
  return progress[observedStatus] > progress[gap.status] ? observedStatus : gap.status;
}

export function calculateFairValueGaps(
  candles: Candle[],
  confirmedIndex: number,
  atrPeriod: number,
  requestedConfig: Partial<FairValueGapConfig> = {},
  qualifyingSignals?: readonly FairValueGapQualification[],
): FairValueGap[] {
  const config = normalizeFairValueGapConfig(requestedConfig);
  const detectedGaps = detectFairValueGaps(candles, confirmedIndex, atrPeriod, config);
  const gaps = qualifyingSignals
    ? detectedGaps.filter((gap) => qualifyingSignals.some(
      (signal) => signal.time === gap.startTime && signal.direction === gap.direction,
    ))
    : detectedGaps;
  const confirmedCandles = candles.slice(0, Math.min(Math.floor(confirmedIndex) + 1, candles.length));

  for (const gap of gaps) {
    for (let index = gap.candleIndex + 1; index < confirmedCandles.length; index++) {
      const candle = confirmedCandles[index];
      if (!isUsableFvgCandle(candle)) continue;
      gap.status = updateStatus(gap, candle, index - gap.candleIndex, config);
      if (
        gap.status === 'fully-filled' ||
        gap.status === 'invalidated' ||
        gap.status === 'expired'
      ) break;
    }
  }

  return gaps.filter((gap) => config.showFilledZones || gap.status !== 'fully-filled');
}
