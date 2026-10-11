'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  ISeriesMarkersPluginApi,
  UTCTimestamp,
  Time,
  SeriesMarker,
} from 'lightweight-charts';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { Candle } from '@/types';
import { Activity } from 'lucide-react';

export const Chart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Active price lines
  const entryLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);
  const tpLineRef = useRef<IPriceLine | null>(null);

  // Store data
  const candles = useTradingSimulatorStore((s) => s.candles);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const openPosition = useTradingSimulatorStore((s) => s.openPosition);
  const tradeHistory = useTradingSimulatorStore((s) => s.tradeHistory);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);

  // Track prev index to decide whether to update single candle or setData
  const prevIndexRef = useRef<number>(-1);

  // Hovered candle for OHLC legend
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

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
      timeScale: {
        borderColor: '#1e2638',
        timeVisible: true,
        secondsVisible: false,
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
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
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

    // Responsive resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
      entryLineRef.current = null;
      slLineRef.current = null;
      tpLineRef.current = null;
    };
  }, []);

  // Update candle data strictly up to currentIndex (no future leakage!)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (candles.length === 0 || currentIndex < 0) {
      series.setData([]);
      prevIndexRef.current = -1;
      return;
    }

    const prevIndex = prevIndexRef.current;
    const isSingleStepForward = currentIndex === prevIndex + 1 && prevIndex >= 0;

    if (isSingleStepForward) {
      // Incremental update for single candle step
      const nextCandle = candles[currentIndex];
      series.update({
        time: nextCandle.timestamp as UTCTimestamp,
        open: nextCandle.open,
        high: nextCandle.high,
        low: nextCandle.low,
        close: nextCandle.close,
      });
    } else {
      // Re-set entire visible slice on jump, reset, or new dataset
      const visible = candles.slice(0, currentIndex + 1).map((c) => ({
        time: c.timestamp as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      series.setData(visible);
    }

    prevIndexRef.current = currentIndex;
  }, [candles, currentIndex]);

  // Update Price Lines for Open Position (Entry, SL, TP)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear existing price lines
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

    // 1. Entry price line
    entryLineRef.current = series.createPriceLine({
      price: openPosition.entryPrice,
      color: '#00d2ff', // Electric cyan
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `${openPosition.side} @ ${openPosition.entryPrice.toFixed(2)}`,
    });

    // 2. Stop loss line
    if (openPosition.stopLoss !== undefined) {
      const riskPts = Math.abs(openPosition.entryPrice - openPosition.stopLoss);
      slLineRef.current = series.createPriceLine({
        price: openPosition.stopLoss,
        color: '#ff2d55', // Vibrant red
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL: ${openPosition.stopLoss.toFixed(2)} (-$${riskPts.toFixed(2)})`,
      });
    }

    // 3. Take profit line
    if (openPosition.takeProfit !== undefined) {
      const rewardPts = Math.abs(openPosition.takeProfit - openPosition.entryPrice);
      tpLineRef.current = series.createPriceLine({
        price: openPosition.takeProfit,
        color: '#00e676', // Mint green
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP: ${openPosition.takeProfit.toFixed(2)} (+$${rewardPts.toFixed(2)})`,
      });
    }
  }, [openPosition]);

  // Update Markers for Trade entries and exits up to current time
  useEffect(() => {
    const markersPlugin = markersPluginRef.current;
    if (!markersPlugin) return;

    const currentReplayTime = currentCandle ? currentCandle.timestamp : 0;
    const markers: SeriesMarker<Time>[] = [];

    // Markers for closed trades
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

    // Marker for current open position entry
    if (openPosition && openPosition.entryTime <= currentReplayTime) {
      markers.push({
        time: openPosition.entryTime as UTCTimestamp,
        position: openPosition.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: openPosition.side === 'LONG' ? '#089981' : '#f23645',
        shape: openPosition.side === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: `${openPosition.side} ${openPosition.quantity}oz`,
      });
    }

    // Sort markers chronologically
    markers.sort((a, b) => (a.time as number) - (b.time as number));

    markersPlugin.setMarkers(markers);
  }, [openPosition, tradeHistory, currentCandle]);

  // Display Candle Legend
  const activeCandle = hoveredCandle || currentCandle;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePercent = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="relative flex-1 w-full h-full min-h-[460px] bg-[#090b10] select-none overflow-hidden flex flex-col">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <span className="font-extrabold text-7xl md:text-9xl text-white tracking-widest font-mono">
          XAUUSD
        </span>
      </div>

      {/* Floating HUD Bar */}
      <div className="absolute top-3 left-4 z-10 flex flex-wrap items-center gap-3 bg-[#0d111a]/90 backdrop-blur-md border border-[#1e273a] px-3.5 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none">
        <div className="flex items-center space-x-1.5 font-bold">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-white tracking-wide">XAUUSD</span>
          <span className="text-[10px] bg-[#161d2d] text-amber-400 border border-amber-500/30 px-1 rounded font-mono">
            {currentTimeframe.toUpperCase()}
          </span>
        </div>

        {activeCandle ? (
          <div className="flex items-center space-x-3 font-mono text-[11px] tabular-nums">
            <div>
              <span className="text-neutral-500 mr-1">O:</span>
              <span className="text-neutral-200 font-semibold">{activeCandle.open.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-1">H:</span>
              <span className="text-neutral-200 font-semibold">{activeCandle.high.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-1">L:</span>
              <span className="text-neutral-200 font-semibold">{activeCandle.low.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-1">C:</span>
              <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeCandle.close.toFixed(2)}
              </span>
            </div>
            <div className={`font-semibold px-1 rounded ${
              isUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
            }`}>
              {isUp ? '+' : ''}
              {priceChange.toFixed(2)} ({isUp ? '+' : ''}
              {priceChangePercent.toFixed(2)}%)
            </div>
          </div>
        ) : (
          <span className="text-neutral-500 italic text-[11px]">Loading historical candlestick data...</span>
        )}
      </div>

      {/* Empty State Overlay */}
      {candles.length === 0 && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center text-center p-6 bg-[#090b10]/90">
          <div className="max-w-md rounded-2xl border border-[#1e2638] bg-[#0f131f] p-8 shadow-2xl backdrop-blur-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Awaiting XAUUSD Candles</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Historical market data is being initialized. Use the Historical Range dialog to select past gold price sessions.
            </p>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full" />
    </div>
  );
};
