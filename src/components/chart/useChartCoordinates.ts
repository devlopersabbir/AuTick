import { useCallback } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Candle } from '@/types';
import { TIMEFRAME_SECONDS } from './chartConstants';

interface ChartCoordinatesOptions {
  chartRef: { current: IChartApi | null };
  seriesRef: { current: ISeriesApi<'Candlestick', Time> | null };
  containerRef: { current: HTMLDivElement | null };
  currentCandle: Candle | null;
  currentIndex: number;
  currentTimeframe: string;
}

export function useChartCoordinates({
  chartRef,
  seriesRef,
  containerRef,
  currentCandle,
  currentIndex,
  currentTimeframe,
}: ChartCoordinatesOptions) {
  return useCallback((clientX: number, clientY: number) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const timeScale = chart.timeScale();
    const time = timeScale.coordinateToTime(x) as number | null;
    const logical = time === null ? timeScale.coordinateToLogical(x) : null;
    const price = series.coordinateToPrice(y) as number | null;
    const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()];

    const resolvedTime = time !== null
      ? time
      : logical !== null && currentCandle && timeframeSeconds
        ? currentCandle.timestamp + Math.round(logical - currentIndex) * timeframeSeconds
        : (currentCandle ? currentCandle.timestamp : Math.floor(Date.now() / 1000));
    const resolvedPrice = price !== null
      ? price
      : (currentCandle ? currentCandle.close : 0);

    return { x, y, time: resolvedTime, price: resolvedPrice };
  }, [chartRef, containerRef, currentCandle, currentIndex, currentTimeframe, seriesRef]);
}
