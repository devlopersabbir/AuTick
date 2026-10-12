import type { Candle } from '@/types';

export interface BreakoutIndicatorConfig {
  lookbackPeriod: number;
  atrPeriod: number;
  fastEmaPeriod: number;
  slowEmaPeriod: number;
  breakoutStrengthWeight: number;
  candleQualityWeight: number;
  trendWeight: number;
  momentumWeight: number;
  wickPenaltyWeight: number;
  breakoutThreshold: number;
  probabilityThreshold: number;
}

export interface BreakoutSignal {
  time: number;
  direction: 'up' | 'down';
  price: number;
  probability: number;
  strength: number;
}

export const DEFAULT_BREAKOUT_INDICATOR_CONFIG: BreakoutIndicatorConfig = {
  lookbackPeriod: 20,
  atrPeriod: 14,
  fastEmaPeriod: 9,
  slowEmaPeriod: 21,
  breakoutStrengthWeight: 0.8,
  candleQualityWeight: 0.7,
  trendWeight: 0.35,
  momentumWeight: 0.3,
  wickPenaltyWeight: 0.4,
  breakoutThreshold: 0.15,
  probabilityThreshold: 0.65,
};

const PERIOD_LIMITS: Record<'lookbackPeriod' | 'atrPeriod' | 'fastEmaPeriod' | 'slowEmaPeriod', number> = {
  lookbackPeriod: 300,
  atrPeriod: 200,
  fastEmaPeriod: 200,
  slowEmaPeriod: 500,
};

export function normalizeBreakoutIndicatorConfig(
  config: Partial<BreakoutIndicatorConfig>,
): BreakoutIndicatorConfig {
  const normalized = { ...DEFAULT_BREAKOUT_INDICATOR_CONFIG };

  for (const key of Object.keys(PERIOD_LIMITS) as Array<keyof typeof PERIOD_LIMITS>) {
    const value = config[key];
    if (Number.isFinite(value)) {
      normalized[key] = Math.max(2, Math.min(PERIOD_LIMITS[key], Math.round(value as number)));
    }
  }

  normalized.fastEmaPeriod = Math.min(normalized.fastEmaPeriod, normalized.slowEmaPeriod - 1);
  normalized.slowEmaPeriod = Math.max(normalized.fastEmaPeriod + 1, normalized.slowEmaPeriod);

  const weightKeys = [
    'breakoutStrengthWeight',
    'candleQualityWeight',
    'trendWeight',
    'momentumWeight',
    'wickPenaltyWeight',
  ] as const;
  for (const key of weightKeys) {
    const value = config[key];
    if (Number.isFinite(value)) normalized[key] = Math.max(0, Math.min(5, value as number));
  }

  if (Number.isFinite(config.breakoutThreshold)) {
    normalized.breakoutThreshold = Math.max(0, Math.min(5, config.breakoutThreshold as number));
  }
  if (Number.isFinite(config.probabilityThreshold)) {
    normalized.probabilityThreshold = Math.max(0.5, Math.min(0.99, config.probabilityThreshold as number));
  }

  return normalized;
}

function calculateEmaSeries(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (period < 1) return output;

  const smoothing = 2 / (period + 1);
  let ema: number | null = null;
  let validCount = 0;
  let seedTotal = 0;

  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!Number.isFinite(value)) {
      ema = null;
      validCount = 0;
      seedTotal = 0;
      continue;
    }

    if (ema === null) {
      seedTotal += value;
      validCount++;
      if (validCount === period) {
        ema = seedTotal / period;
        output[index] = ema;
      }
      continue;
    }

    ema = value * smoothing + ema * (1 - smoothing);
    output[index] = ema;
  }

  return output;
}

function calculateAtrSeries(candles: Candle[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(candles.length).fill(null);
  const trueRanges: Array<number | null> = Array(candles.length).fill(null);

  for (let index = 1; index < candles.length; index++) {
    const candle = candles[index];
    const previousCandle = candles[index - 1];
    if (!isUsableCandle(candle) || !isUsableCandle(previousCandle)) continue;
    const previousClose = previousCandle.close;
    trueRanges[index] = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  }

  let total = 0;
  let missingValues = 0;
  for (let index = 1; index < candles.length; index++) {
    const currentRange = trueRanges[index];
    if (currentRange === null) missingValues++;
    else total += currentRange;

    const removedIndex = index - period;
    if (removedIndex >= 1) {
      const removedRange = trueRanges[removedIndex];
      if (removedRange === null) missingValues--;
      else total -= removedRange;
    }

    if (index >= period && missingValues === 0) output[index] = total / period;
  }

  return output;
}

function logistic(score: number): number {
  const boundedScore = Math.max(-60, Math.min(60, score));
  return 1 / (1 + Math.exp(-boundedScore));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isUsableCandle(candle: Candle | undefined): candle is Candle {
  if (!candle) return false;
  const values = [candle.timestamp, candle.open, candle.high, candle.low, candle.close];
  return values.every(Number.isFinite) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close;
}

function calculateDirectionalScore(
  direction: 'up' | 'down',
  breakoutStrength: number,
  closeLocation: number,
  trend: number,
  momentum: number,
  wickPenalty: number,
  config: BreakoutIndicatorConfig,
): number {
  const sign = direction === 'up' ? 1 : -1;
  const directionalCloseQuality = direction === 'up' ? closeLocation : 1 - closeLocation;

  return (
    config.breakoutStrengthWeight * breakoutStrength +
    config.candleQualityWeight * directionalCloseQuality +
    config.trendWeight * sign * trend +
    config.momentumWeight * sign * momentum -
    config.wickPenaltyWeight * wickPenalty
  );
}

export function calculateBreakoutSignals(
  candles: Candle[],
  currentIndex: number,
  timeframeSeconds: number,
  nowSeconds: number,
  requestedConfig: Partial<BreakoutIndicatorConfig> = {},
): BreakoutSignal[] {
  if (!Number.isFinite(timeframeSeconds) || timeframeSeconds <= 0 || candles.length === 0) return [];

  const config = normalizeBreakoutIndicatorConfig(requestedConfig);
  const visibleCandles = candles.slice(0, Math.min(currentIndex + 1, candles.length));
  const closes = visibleCandles.map((candle) => isUsableCandle(candle) ? candle.close : NaN);
  const atrSeries = calculateAtrSeries(visibleCandles, config.atrPeriod);
  const fastEma = calculateEmaSeries(closes, config.fastEmaPeriod);
  const slowEma = calculateEmaSeries(closes, config.slowEmaPeriod);
  const signals: BreakoutSignal[] = [];

  const firstEligibleIndex = Math.max(
    config.lookbackPeriod,
    config.atrPeriod,
    config.slowEmaPeriod,
    1,
  );
  let activeBreakout: { direction: 'up' | 'down'; level: number } | null = null;

  for (let index = firstEligibleIndex; index < visibleCandles.length; index++) {
    const candle = visibleCandles[index];
    if (!isUsableCandle(candle)) continue;
    if (candle.timestamp + timeframeSeconds > nowSeconds) continue;

    const atr = atrSeries[index];
    const fast = fastEma[index];
    const slow = slowEma[index];
    const previousFast = fastEma[index - 1];
    if (atr === null || atr <= 0 || fast === null || slow === null || previousFast === null) continue;

    const candleRange = candle.high - candle.low;
    if (candleRange <= 0) continue;

    const previousCandles = visibleCandles.slice(index - config.lookbackPeriod, index);
    if (!previousCandles.every(isUsableCandle) || !isUsableCandle(visibleCandles[index - 1])) continue;
    const resistance = Math.max(...previousCandles.map((item) => item.high));
    const support = Math.min(...previousCandles.map((item) => item.low));
    const previousClose = visibleCandles[index - 1].close;
    if (
      activeBreakout?.direction === 'up' && candle.close <= activeBreakout.level ||
      activeBreakout?.direction === 'down' && candle.close >= activeBreakout.level
    ) {
      activeBreakout = null;
    }
    const bullishBreakoutStrength = (candle.close - resistance) / atr;
    const bearishBreakoutStrength = (support - candle.close) / atr;
    const bullishBreakout = activeBreakout?.direction !== 'up' &&
      previousClose <= resistance &&
      candle.close > resistance &&
      bullishBreakoutStrength >= config.breakoutThreshold;
    const bearishBreakout = activeBreakout?.direction !== 'down' &&
      previousClose >= support &&
      candle.close < support &&
      bearishBreakoutStrength >= config.breakoutThreshold;
    if (!bullishBreakout && !bearishBreakout) continue;

    const closeLocation = clamp((candle.close - candle.low) / candleRange, 0, 1);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWickPenalty = clamp(upperWick / candleRange, 0, 1);
    const lowerWickPenalty = clamp(lowerWick / candleRange, 0, 1);
    const trend = clamp(((fast - slow) + (fast - previousFast)) / atr, -5, 5);
    const momentum = clamp((candle.close - fast) / atr, -5, 5);

    const bullishScore = calculateDirectionalScore(
      'up',
      bullishBreakoutStrength,
      closeLocation,
      trend,
      momentum,
      upperWickPenalty,
      config,
    );
    const bearishScore = calculateDirectionalScore(
      'down',
      bearishBreakoutStrength,
      closeLocation,
      trend,
      momentum,
      lowerWickPenalty,
      config,
    );
    const bullishProbability = logistic(bullishScore);
    const bearishProbability = logistic(bearishScore);

    let signal: BreakoutSignal | null = null;
    if (bullishBreakout && bullishProbability >= config.probabilityThreshold) {
      signal = {
        time: candle.timestamp,
        direction: 'up',
        price: candle.close,
        probability: bullishProbability,
        strength: bullishBreakoutStrength,
      };
    } else if (bearishBreakout && bearishProbability >= config.probabilityThreshold) {
      signal = {
        time: candle.timestamp,
        direction: 'down',
        price: candle.close,
        probability: bearishProbability,
        strength: bearishBreakoutStrength,
      };
    }

    if (signal) {
      signals.push(signal);
      activeBreakout = {
        direction: signal.direction,
        level: signal.direction === 'up' ? resistance : support,
      };
    }
  }

  return signals;
}
