import { useEffect, useRef } from 'react';
import {
  createChart, CandlestickSeries, LineStyle, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type IPriceLine, type ISeriesMarkersPluginApi,
  type Time, type UTCTimestamp, type SeriesMarker, type TickMarkType,
} from 'lightweight-charts';
import type { Candle } from '@/types';
import type { TradingSimulatorState } from '@/stores/tradingSimulatorStoreTypes';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { formatCrosshairTimeWithSession, formatTickMarkAmPm } from '@/lib/utils/sessions';
import { calculateBreakoutSignals, type BreakoutIndicatorConfig } from '@/lib/market-data/breakout-indicator';
import { TIMEFRAME_SECONDS } from './chartConstants';

type ChartTheme = {
  upColor: string; downColor: string; wickUpColor: string; wickDownColor: string;
  borderUpColor: string; borderDownColor: string;
};

interface ChartLifecycleOptions {
  containerRef: { current: HTMLDivElement | null };
  chartRef: { current: IChartApi | null };
  seriesRef: { current: ISeriesApi<'Candlestick', Time> | null };
  chartTheme: ChartTheme;
  setHoveredCandle: React.Dispatch<React.SetStateAction<Candle | null>>;
  setViewportKey: React.Dispatch<React.SetStateAction<number>>;
  candles: Candle[];
  currentIndex: number;
  isLiveMode: boolean;
  currentCandle: Candle | null;
  openPosition: TradingSimulatorState['openPosition'];
  tradeHistory: TradingSimulatorState['tradeHistory'];
  candleCountdown: string | null;
  isMarketOpen: boolean;
  breakoutEnabled: boolean;
  breakoutConfig: BreakoutIndicatorConfig;
  currentTimeframe: string;
}

export function useChartLifecycle({
  containerRef, chartRef, seriesRef, chartTheme, setHoveredCandle, setViewportKey,
  candles, currentIndex, isLiveMode, currentCandle, openPosition, tradeHistory,
  candleCountdown, isMarketOpen, breakoutEnabled, breakoutConfig, currentTimeframe,
}: ChartLifecycleOptions) {
  const initialChartThemeRef = useRef(chartTheme);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const entryLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);
  const tpLineRef = useRef<IPriceLine | null>(null);
  const candleCloseLineRef = useRef<IPriceLine | null>(null);
  const prevIndexRef = useRef<number>(-1);
  const replayAnimationFrameRef = useRef<number | null>(null);
  const renderedCurrentCandleRef = useRef<Candle | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#090b10' },
        textColor: '#8892b0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      grid: {
        vertLines: { color: '#131824' },
        horzLines: { color: '#131824' },
      },
      crosshair: {
        mode: 1, // Magnet
        vertLine: {
          color: '#3d4760',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1a2233',
        },
        horzLine: {
          color: '#3d4760',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1a2233',
        },
      },
      rightPriceScale: {
        borderColor: '#1e2638',
        textColor: '#94a3b8',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          const timestamp = typeof time === 'number' ? time : 0;
          return formatCrosshairTimeWithSession(timestamp);
        },
      },
      timeScale: {
        borderColor: '#1e2638',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          const timestamp = typeof time === 'number' ? time : 0;
          return formatTickMarkAmPm(timestamp, tickMarkType);
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: initialChartThemeRef.current.upColor,
      downColor: initialChartThemeRef.current.downColor,
      borderVisible: false,
      wickUpColor: initialChartThemeRef.current.wickUpColor,
      wickDownColor: initialChartThemeRef.current.wickDownColor,
      borderUpColor: initialChartThemeRef.current.borderUpColor,
      borderDownColor: initialChartThemeRef.current.borderDownColor,
    });

    const markersPlugin = createSeriesMarkers(candlestickSeries, []);
    markersPluginRef.current = markersPlugin;

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Crosshair listener for legend display
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !param.seriesData.get(candlestickSeries)) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candlestickSeries) as {
        open: number;
        high: number;
        low: number;
        close: number;
        time: number;
      };
      if (data) {
        setHoveredCandle({
          timestamp: data.time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        });
      }
    });

    // Re-project drawings on pan/zoom
    const triggerRerender = () => setViewportKey((k) => k + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(triggerRerender);

    // Infinite Historical Scrollback: detect scroll near the left edge
    chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      triggerRerender();
      if (logicalRange && logicalRange.from < 30) {
        // Fetch older historical candles seamlessly
        const state = useTradingSimulatorStore.getState();
        if (!state.isLoadingOlderData && !state.hasReachedBeginning && state.candles.length > 0) {
          state.fetchOlderCandles();
        }
      }
    });

    // Responsive resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      triggerRerender();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
        replayAnimationFrameRef.current = null;
      }

      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(triggerRerender);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
      entryLineRef.current = null;
      slLineRef.current = null;
      tpLineRef.current = null;
      candleCloseLineRef.current = null;
    };
  }, [chartRef, containerRef, initialChartThemeRef, seriesRef, setHoveredCandle, setViewportKey]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      upColor: chartTheme.upColor,
      downColor: chartTheme.downColor,
      wickUpColor: chartTheme.wickUpColor,
      wickDownColor: chartTheme.wickDownColor,
      borderUpColor: chartTheme.borderUpColor,
      borderDownColor: chartTheme.borderDownColor,
    });
  }, [chartTheme, seriesRef]);

  // Update candle data strictly up to currentIndex (no future leakage!)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (candles.length === 0 || currentIndex < 0) {
      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
        replayAnimationFrameRef.current = null;
      }
      series.setData([]);
      prevIndexRef.current = -1;
      renderedCurrentCandleRef.current = null;
      return;
    }

    const prevIndex = prevIndexRef.current;
    const isSingleStepForward = currentIndex === prevIndex + 1 && prevIndex >= 0;
    const nextCandle = candles[currentIndex];
    const previousRenderedCandle = renderedCurrentCandleRef.current;
    const isLiveCandleUpdate = isLiveMode && currentIndex === prevIndex &&
      previousRenderedCandle?.timestamp === nextCandle.timestamp;

    if (isLiveCandleUpdate && previousRenderedCandle) {
      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
      }

      const durationMs = 850;
      const startTime = performance.now();
      const animateLiveCandle = (now: number) => {
        const progress = Math.min((now - startTime) / durationMs, 1);
        const eased = 1 - (1 - progress) ** 3;
        const interpolatedCandle = {
          timestamp: nextCandle.timestamp,
          open: previousRenderedCandle.open + (nextCandle.open - previousRenderedCandle.open) * eased,
          high: previousRenderedCandle.high + (nextCandle.high - previousRenderedCandle.high) * eased,
          low: previousRenderedCandle.low + (nextCandle.low - previousRenderedCandle.low) * eased,
          close: previousRenderedCandle.close + (nextCandle.close - previousRenderedCandle.close) * eased,
        };

        series.update({
          time: interpolatedCandle.timestamp as UTCTimestamp,
          open: interpolatedCandle.open,
          high: interpolatedCandle.high,
          low: interpolatedCandle.low,
          close: interpolatedCandle.close,
        });
        renderedCurrentCandleRef.current = interpolatedCandle;

        if (progress < 1) {
          replayAnimationFrameRef.current = requestAnimationFrame(animateLiveCandle);
          return;
        }

        renderedCurrentCandleRef.current = nextCandle;
        replayAnimationFrameRef.current = null;
      };

      replayAnimationFrameRef.current = requestAnimationFrame(animateLiveCandle);
    } else if (isSingleStepForward) {
      const previousCandle = candles[currentIndex - 1];
      const durationMs = 220;
      const startTime = performance.now();

      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
      }

      const animateCandle = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - (1 - progress) ** 3;

        const interpolatedCandle = {
          timestamp: nextCandle.timestamp,
          open: previousCandle.open + (nextCandle.open - previousCandle.open) * eased,
          high: previousCandle.high + (nextCandle.high - previousCandle.high) * eased,
          low: previousCandle.low + (nextCandle.low - previousCandle.low) * eased,
          close: previousCandle.close + (nextCandle.close - previousCandle.close) * eased,
        };
        series.update({
          time: interpolatedCandle.timestamp as UTCTimestamp,
          open: interpolatedCandle.open,
          high: interpolatedCandle.high,
          low: interpolatedCandle.low,
          close: interpolatedCandle.close,
        });
        renderedCurrentCandleRef.current = interpolatedCandle;

        if (progress < 1) {
          replayAnimationFrameRef.current = requestAnimationFrame(animateCandle);
          return;
        }

        series.update({
          time: nextCandle.timestamp as UTCTimestamp,
          open: nextCandle.open,
          high: nextCandle.high,
          low: nextCandle.low,
          close: nextCandle.close,
        });
        renderedCurrentCandleRef.current = nextCandle;
        replayAnimationFrameRef.current = null;
      };

      replayAnimationFrameRef.current = requestAnimationFrame(animateCandle);
    } else {
      // Re-set entire visible slice on jump, reset, cut, or older data prepended
      const visible = candles.slice(0, currentIndex + 1).map((c) => ({
        time: c.timestamp as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
        replayAnimationFrameRef.current = null;
      }
      series.setData(visible);
      renderedCurrentCandleRef.current = candles[currentIndex] ?? null;
    }

    prevIndexRef.current = currentIndex;
  }, [candles, currentIndex, isLiveMode, seriesRef]);

  // Update Price Lines for Open Position (Entry, SL, TP)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (entryLineRef.current) {
      series.removePriceLine(entryLineRef.current);
      entryLineRef.current = null;
    }
    if (slLineRef.current) {
      series.removePriceLine(slLineRef.current);
      slLineRef.current = null;
    }
    if (tpLineRef.current) {
      series.removePriceLine(tpLineRef.current);
      tpLineRef.current = null;
    }

    if (!openPosition) return;

    entryLineRef.current = series.createPriceLine({
      price: openPosition.entryPrice,
      color: '#00d2ff',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `${openPosition.side} @ ${openPosition.entryPrice.toFixed(2)}`,
    });

    if (openPosition.stopLoss !== undefined) {
      const riskPts = Math.abs(openPosition.entryPrice - openPosition.stopLoss);
      slLineRef.current = series.createPriceLine({
        price: openPosition.stopLoss,
        color: '#ff2d55',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL: ${openPosition.stopLoss.toFixed(2)} (-$${riskPts.toFixed(2)})`,
      });
    }

    if (openPosition.takeProfit !== undefined) {
      const rewardPts = Math.abs(openPosition.takeProfit - openPosition.entryPrice);
      tpLineRef.current = series.createPriceLine({
        price: openPosition.takeProfit,
        color: '#00e676',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP: ${openPosition.takeProfit.toFixed(2)} (+$${rewardPts.toFixed(2)})`,
      });
    }
  }, [openPosition, seriesRef]);

  // Update Markers for Trade entries and exits up to current time
  useEffect(() => {
    const markersPlugin = markersPluginRef.current;
    if (!markersPlugin) return;

    const currentReplayTime = currentCandle ? currentCandle.timestamp : 0;
    const markers: SeriesMarker<Time>[] = [];

    for (const trade of tradeHistory) {
      if (trade.entryTime <= currentReplayTime) {
        markers.push({
          time: trade.entryTime as UTCTimestamp,
          position: trade.side === 'LONG' ? 'belowBar' : 'aboveBar',
          color: trade.side === 'LONG' ? '#089981' : '#f23645',
          shape: trade.side === 'LONG' ? 'arrowUp' : 'arrowDown',
          text: `${trade.side} ${trade.quantity}oz`,
        });
      }

      if (trade.exitTime <= currentReplayTime) {
        const isWin = trade.netPnl >= 0;
        markers.push({
          time: trade.exitTime as UTCTimestamp,
          position: 'inBar',
          color: isWin ? '#089981' : '#f23645',
          shape: 'circle',
          text: `${trade.exitReason}: ${isWin ? '+' : ''}$${trade.netPnl.toFixed(2)}`,
        });
      }
    }

    if (openPosition && openPosition.entryTime <= currentReplayTime) {
      markers.push({
        time: openPosition.entryTime as UTCTimestamp,
        position: openPosition.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: openPosition.side === 'LONG' ? '#089981' : '#f23645',
        shape: openPosition.side === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: `${openPosition.side} ${openPosition.quantity}oz`,
      });
    }

    if (breakoutEnabled) {
      const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
      const breakouts = calculateBreakoutSignals(
        candles,
        currentIndex,
        timeframeSeconds,
        Math.floor(Date.now() / 1000),
        breakoutConfig,
      );

      for (const breakout of breakouts) {
        markers.push({
          time: breakout.time as UTCTimestamp,
          position: breakout.direction === 'up' ? 'belowBar' : 'aboveBar',
          color: breakout.direction === 'up' ? '#22c55e' : '#ef4444',
          shape: breakout.direction === 'up' ? 'arrowUp' : 'arrowDown',
          size: 2,
        });
      }
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersPlugin.setMarkers(markers);
  }, [
    openPosition,
    tradeHistory,
    currentCandle,
    seriesRef,
    candles,
    currentIndex,
    isLiveMode,
    breakoutEnabled,
    breakoutConfig,
    currentTimeframe,
  ]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (!candleCountdown || !currentCandle || !isLiveMode || !isMarketOpen) {
      if (candleCloseLineRef.current) {
        series.removePriceLine(candleCloseLineRef.current);
        candleCloseLineRef.current = null;
      }
      series.applyOptions({ lastValueVisible: true });
      return;
    }

    const priceColor = currentCandle.close >= currentCandle.open ? '#089981' : '#f23645';
    const priceLineOptions = {
      price: currentCandle.close,
      color: priceColor,
      lineWidth: 1 as const,
      lineStyle: LineStyle.Solid,
      lineVisible: false,
      axisLabelVisible: true,
      axisLabelColor: priceColor,
      title: candleCountdown,
    };

    series.applyOptions({ lastValueVisible: false });
    if (candleCloseLineRef.current) {
      candleCloseLineRef.current.applyOptions(priceLineOptions);
    } else {
      candleCloseLineRef.current = series.createPriceLine(priceLineOptions);
    }
  }, [candleCountdown, currentCandle, isLiveMode, isMarketOpen, seriesRef]);

}
