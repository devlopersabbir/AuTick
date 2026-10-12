import type { Candle } from '@/types';

export const BREAKOUT_LOOKBACK_CANDLES = 20;

export interface BreakoutSignal {
  time: number;
  direction: 'up' | 'down';
  price: number;
}

export function findClosedCandleBreakouts(
  candles: Candle[],
  currentIndex: number,
  timeframeSeconds: number,
  nowSeconds: number,
  lookback = BREAKOUT_LOOKBACK_CANDLES,
): BreakoutSignal[] {
  if (timeframeSeconds <= 0 || lookback <= 0) return [];

  const lastIndex = Math.min(currentIndex, candles.length - 1);
  const signals: BreakoutSignal[] = [];

  for (let index = lookback; index <= lastIndex; index++) {
    const candle = candles[index];
    if (candle.timestamp + timeframeSeconds > nowSeconds) continue;

    const previous = candles.slice(index - lookback, index);
    const rangeHigh = Math.max(...previous.map((item) => item.high));
    const rangeLow = Math.min(...previous.map((item) => item.low));
    const previousClose = candles[index - 1].close;

    if (candle.close > rangeHigh && previousClose <= rangeHigh) {
      signals.push({ time: candle.timestamp, direction: 'up', price: candle.close });
    } else if (candle.close < rangeLow && previousClose >= rangeLow) {
      signals.push({ time: candle.timestamp, direction: 'down', price: candle.close });
    }
  }

  return signals;
}
