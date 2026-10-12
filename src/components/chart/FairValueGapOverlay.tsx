'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IChartApi, ISeriesApi, Logical, Time, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '@/types';
import {
  type FairValueGap,
  type FairValueGapConfig,
} from '@/lib/market-data/fair-value-gap';
import {
  calculateFairValueGaps,
  getLastConfirmedCandleIndex,
  type FairValueGapQualification,
} from '@/lib/market-data/fair-value-gap-lifecycle';
import {
  calculateBreakoutSignals,
  type BreakoutIndicatorConfig,
} from '@/lib/market-data/breakout-indicator';
import { TIMEFRAME_SECONDS } from './chartConstants';

interface FairValueGapOverlayProps {
  chartRef: { current: IChartApi | null };
  seriesRef: { current: ISeriesApi<'Candlestick', Time> | null };
  candles: Candle[];
  currentIndex: number;
  isLiveMode: boolean;
  currentTimeframe: string;
  viewportKey: number;
  enabled: boolean;
  config: FairValueGapConfig;
  breakoutConfig: BreakoutIndicatorConfig;
}

interface ProjectedGap extends FairValueGap {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function FairValueGapOverlay({
  chartRef,
  seriesRef,
  candles,
  currentIndex,
  isLiveMode,
  currentTimeframe,
  viewportKey,
  enabled,
  config,
  breakoutConfig,
}: FairValueGapOverlayProps) {
  const [projectedGaps, setProjectedGaps] = useState<ProjectedGap[]>([]);
  const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
  const confirmedIndex = getLastConfirmedCandleIndex(
    candles,
    currentIndex,
    isLiveMode,
  );
  const qualifyingSignals = useMemo<FairValueGapQualification[]>(() => {
    const lastConfirmedCandle = candles[confirmedIndex];
    if (!enabled || !lastConfirmedCandle) return [];
    const signals = calculateBreakoutSignals(
      candles,
      confirmedIndex,
      timeframeSeconds,
      lastConfirmedCandle.timestamp + timeframeSeconds,
      breakoutConfig,
    );
    return signals.map((signal) => ({
      time: signal.time,
      direction: signal.direction === 'up' ? 'bullish' : 'bearish',
    }));
  }, [candles, confirmedIndex, enabled, timeframeSeconds, breakoutConfig]);
  const gaps = useMemo(
    () => enabled
      ? calculateFairValueGaps(candles, confirmedIndex, 14, config, qualifyingSignals)
      : [],
    [candles, confirmedIndex, enabled, config, qualifyingSignals],
  );

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !enabled) return;

    const timeScale = chart.timeScale();
    const referenceIndex = Math.min(currentIndex, candles.length - 1);
    const referenceCandle = candles[referenceIndex];
    if (!referenceCandle) return;

    const toX = (timestamp: number) => {
      const direct = timeScale.timeToCoordinate(timestamp as UTCTimestamp);
      if (direct !== null) return direct;
      const logical = referenceIndex + (timestamp - referenceCandle.timestamp) / timeframeSeconds;
      return timeScale.logicalToCoordinate(logical as Logical);
    };

    const projected = gaps.flatMap((gap) => {
      if (gap.status === 'expired') return [];
      const x1 = toX(gap.startTime);
      const x2 = toX(gap.startTime + config.extensionCandles * timeframeSeconds);
      const y1 = series.priceToCoordinate(gap.upperBoundary);
      const y2 = series.priceToCoordinate(gap.lowerBoundary);
      if (x1 === null || x2 === null || y1 === null || y2 === null) return [];

      return [{
        ...gap,
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      }];
    });
    setProjectedGaps(projected);
  }, [
    chartRef,
    seriesRef,
    candles,
    currentIndex,
    isLiveMode,
    currentTimeframe,
    timeframeSeconds,
    viewportKey,
    enabled,
    config.extensionCandles,
    gaps,
  ]);

  if (!enabled) return null;

  return (
    <g className="pointer-events-none">
      {projectedGaps.map((gap) => {
        const bullish = gap.direction === 'bullish';
        const color = bullish ? '#22c55e' : '#ef4444';
        const opacity = gap.status === 'partially-filled' ? 0.09 : gap.status === 'touched' ? 0.11 : 0.15;

        return (
          <g key={gap.id}>
            <rect
              x={gap.x}
              y={gap.y}
              width={gap.width}
              height={gap.height}
              fill={color}
              fillOpacity={opacity}
              stroke={color}
              strokeOpacity={0.75}
              strokeWidth="1"
            />
            <text
              x={gap.x + gap.width / 2}
              y={gap.y + gap.height / 2}
              fill="#ffffff"
              fontSize="10"
              fontWeight="700"
              fontFamily="sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              paintOrder="stroke"
              stroke="#111827"
              strokeWidth="2.5"
              strokeLinejoin="round"
            >
              FVG
            </text>
          </g>
        );
      })}
    </g>
  );
}
