'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { DataPoint, PositionToolDrawing, ToolType } from '@/types/drawings';
import { Activity, Radio, Scissors, Play, X, Zap } from 'lucide-react';

interface ProjectedDrawing {
  id: string;
  type: ToolType;
  color?: string;
  // For trendline
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  // For horizontal_line
  y?: number;
  price?: number;
  // For rectangle
  rect?: { x: number; y: number; width: number; height: number };
  // For circle
  circle?: { cx: number; cy: number; radius: number };
  // For text
  text?: { x: number; y: number; text: string };
  // For position tool
  position?: {
    isLong: boolean;
    startX: number;
    boxWidth: number;
    entryY: number;
    targetZoneTop: number;
    targetZoneHeight: number;
    stopZoneTop: number;
    stopZoneHeight: number;
    riskPts: number;
    rewardPts: number;
    rrRatio: string;
    tpPrice: number;
    slPrice: number;
    raw: PositionToolDrawing;
  };
}

interface ProjectedPreview {
  trendline?: { x1: number; y1: number; x2: number; y2: number };
  rectangle?: { x: number; y: number; width: number; height: number };
  circle?: { cx: number; cy: number; radius: number };
}

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
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);
  const updateLiveCandles = useTradingSimulatorStore((s) => s.updateLiveCandles);

  // Tools & Drawings
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);
  const drawings = useTradingSimulatorStore((s) => s.drawings);
  const addDrawing = useTradingSimulatorStore((s) => s.addDrawing);
  const removeDrawing = useTradingSimulatorStore((s) => s.removeDrawing);
  const cutToBar = useTradingSimulatorStore((s) => s.cutToBar);
  const returnToLive = useTradingSimulatorStore((s) => s.returnToLive);
  const openOrder = useTradingSimulatorStore((s) => s.openOrder);

  // Drawing state
  const [drawingStartPoint, setDrawingStartPoint] = useState<DataPoint | null>(null);
  const [currentMousePoint, setCurrentMousePoint] = useState<{ x: number; y: number; time: number; price: number } | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Projected SVG coordinates (computed in effect, not in render)
  const [projectedDrawings, setProjectedDrawings] = useState<ProjectedDrawing[]>([]);
  const [projectedPreview, setProjectedPreview] = useState<ProjectedPreview | null>(null);

  // Force re-projection key when chart zooms/pans
  const [viewportKey, setViewportKey] = useState(0);

  // Track prev index to decide whether to update single candle or setData
  const prevIndexRef = useRef<number>(-1);

  // Hovered candle for OHLC legend
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Real-time live market polling interval (every 2.5s)
  useEffect(() => {
    if (!isLiveMode) return;

    let isMounted = true;
    const pollLive = async () => {
      try {
        const res = await fetch(`/api/market-data?live=true&timeframe=${currentTimeframe}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.candles) && data.candles.length > 0) {
          updateLiveCandles(data.candles);
        }
      } catch {
        // Silent catch for network hiccups
      }
    };

    const intervalId = setInterval(pollLive, 2500);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isLiveMode, currentTimeframe, updateLiveCandles]);

  // Convert client coordinates to chart DataPoint (time + price)
  const getChartDataPoint = useCallback((clientX: number, clientY: number) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x) as number | null;
    const price = series.coordinateToPrice(y) as number | null;

    const resolvedTime = time !== null
      ? time
      : (currentCandle ? currentCandle.timestamp : Math.floor(Date.now() / 1000));

    const resolvedPrice = price !== null
      ? price
      : (currentCandle ? currentCandle.close : 0);

    return {
      x,
      y,
      time: resolvedTime,
      price: resolvedPrice,
    };
  }, [currentCandle]);

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

    // Re-project drawings on pan/zoom
    const triggerRerender = () => setViewportKey((k) => k + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(triggerRerender);
    chart.timeScale().subscribeVisibleLogicalRangeChange(triggerRerender);

    // Responsive resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      triggerRerender();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(triggerRerender);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(triggerRerender);
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
      // Re-set entire visible slice on jump, reset, cut, or new dataset
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

  // Project drawings into pixel coordinates inside an effect (strictly avoids reading refs during render)
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const timeScale = chart.timeScale();
    const toCoords = (pt: DataPoint) => {
      const x = timeScale.timeToCoordinate(pt.time as UTCTimestamp);
      const y = series.priceToCoordinate(pt.price);
      if (x === null || y === null) return null;
      return { x, y };
    };

    const results: ProjectedDrawing[] = [];

    for (const d of drawings) {
      if (d.type === 'horizontal_line') {
        const y = series.priceToCoordinate(d.price);
        if (y !== null) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            y,
            price: d.price,
          });
        }
      } else if (d.type === 'trendline') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          results.push({ id: d.id, type: d.type, color: d.color, p1, p2 });
        }
      } else if (d.type === 'rectangle') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            rect: {
              x: Math.min(p1.x, p2.x),
              y: Math.min(p1.y, p2.y),
              width: Math.abs(p1.x - p2.x),
              height: Math.abs(p1.y - p2.y),
            },
          });
        }
      } else if (d.type === 'circle') {
        const center = toCoords(d.center);
        const edge = toCoords(d.edge);
        if (center && edge) {
          const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            circle: { cx: center.x, cy: center.y, radius },
          });
        }
      } else if (d.type === 'text') {
        const pt = toCoords(d.point);
        if (pt) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            text: { x: pt.x, y: pt.y, text: d.text },
          });
        }
      } else if (d.type === 'long_position' || d.type === 'short_position') {
        const isLong = d.type === 'long_position';
        const entryY = series.priceToCoordinate(d.entryPoint.price);
        const slY = series.priceToCoordinate(d.stopLossPrice);
        const tpY = series.priceToCoordinate(d.takeProfitPrice);
        const startX = timeScale.timeToCoordinate(d.entryPoint.time as UTCTimestamp);
        const endX = d.targetTime ? timeScale.timeToCoordinate(d.targetTime as UTCTimestamp) : null;

        if (entryY !== null && slY !== null && tpY !== null && startX !== null) {
          const boxWidth = Math.max(140, endX !== null ? endX - startX : 200);
          const targetZoneTop = Math.min(entryY, tpY);
          const targetZoneHeight = Math.abs(tpY - entryY);
          const stopZoneTop = Math.min(entryY, slY);
          const stopZoneHeight = Math.abs(slY - entryY);
          const riskPts = Math.abs(d.entryPoint.price - d.stopLossPrice);
          const rewardPts = Math.abs(d.takeProfitPrice - d.entryPoint.price);
          const rrRatio = riskPts > 0 ? (rewardPts / riskPts).toFixed(2) : '0.00';

          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            position: {
              isLong,
              startX,
              boxWidth,
              entryY,
              targetZoneTop,
              targetZoneHeight,
              stopZoneTop,
              stopZoneHeight,
              riskPts,
              rewardPts,
              rrRatio,
              tpPrice: d.takeProfitPrice,
              slPrice: d.stopLossPrice,
              raw: d,
            },
          });
        }
      }
    }

    setProjectedDrawings(results);

    // Compute multi-point preview if in progress
    if (drawingStartPoint && currentMousePoint) {
      const p1 = toCoords(drawingStartPoint);
      if (p1) {
        if (activeTool === 'trendline') {
          setProjectedPreview({
            trendline: { x1: p1.x, y1: p1.y, x2: currentMousePoint.x, y2: currentMousePoint.y },
          });
        } else if (activeTool === 'rectangle') {
          setProjectedPreview({
            rectangle: {
              x: Math.min(p1.x, currentMousePoint.x),
              y: Math.min(p1.y, currentMousePoint.y),
              width: Math.abs(p1.x - currentMousePoint.x),
              height: Math.abs(p1.y - currentMousePoint.y),
            },
          });
        } else if (activeTool === 'circle') {
          setProjectedPreview({
            circle: {
              cx: p1.x,
              cy: p1.y,
              radius: Math.hypot(currentMousePoint.x - p1.x, currentMousePoint.y - p1.y),
            },
          });
        }
      }
    } else {
      setProjectedPreview(null);
    }
  }, [viewportKey, drawings, drawingStartPoint, currentMousePoint, activeTool, candles, currentIndex]);

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

    // 1. Entry price line
    entryLineRef.current = series.createPriceLine({
      price: openPosition.entryPrice,
      color: '#00d2ff',
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
        color: '#ff2d55',
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
        color: '#00e676',
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

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersPlugin.setMarkers(markers);
  }, [openPosition, tradeHistory, currentCandle]);

  // Mouse interaction handler on SVG overlay
  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (pt) {
      setCurrentMousePoint(pt);
    }
  };

  const handleOverlayMouseLeave = () => {
    setCurrentMousePoint(null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;

    const clickedPoint: DataPoint = { time: pt.time, price: pt.price };

    // 1. Bar Replay / Cut Tool
    if (activeTool === 'bar_replay') {
      cutToBar(clickedPoint.time);
      return;
    }

    // 2. Long Position Tool (TradingView Style)
    if (activeTool === 'long_position') {
      const entryPrice = Math.round(clickedPoint.price * 100) / 100;
      const riskAmount = 10;
      const rewardAmount = 20;
      const slPrice = Math.round((entryPrice - riskAmount) * 100) / 100;
      const tpPrice = Math.round((entryPrice + rewardAmount) * 100) / 100;
      const targetTime = clickedPoint.time + 25 * 60;

      addDrawing({
        id: crypto.randomUUID(),
        type: 'long_position',
        entryPoint: clickedPoint,
        stopLossPrice: slPrice,
        takeProfitPrice: tpPrice,
        quantity: 1,
        targetTime,
      });

      setActiveTool('cursor');
      return;
    }

    // 3. Short Position Tool (TradingView Style)
    if (activeTool === 'short_position') {
      const entryPrice = Math.round(clickedPoint.price * 100) / 100;
      const riskAmount = 10;
      const rewardAmount = 20;
      const slPrice = Math.round((entryPrice + riskAmount) * 100) / 100;
      const tpPrice = Math.round((entryPrice - rewardAmount) * 100) / 100;
      const targetTime = clickedPoint.time + 25 * 60;

      addDrawing({
        id: crypto.randomUUID(),
        type: 'short_position',
        entryPoint: clickedPoint,
        stopLossPrice: slPrice,
        takeProfitPrice: tpPrice,
        quantity: 1,
        targetTime,
      });

      setActiveTool('cursor');
      return;
    }

    // 4. Horizontal Line
    if (activeTool === 'horizontal_line') {
      addDrawing({
        id: crypto.randomUUID(),
        type: 'horizontal_line',
        price: clickedPoint.price,
        time: clickedPoint.time,
        color: '#38bdf8',
      });
      setActiveTool('cursor');
      return;
    }

    // 5. Text Annotation
    if (activeTool === 'text') {
      setTextInputPos({ x: pt.x, y: pt.y, point: clickedPoint });
      setTextInputValue('');
      return;
    }

    // 6. Multi-point tools (Trendline, Rectangle, Circle)
    if (!drawingStartPoint) {
      setDrawingStartPoint(clickedPoint);
    } else {
      const p1 = drawingStartPoint;
      const p2 = clickedPoint;

      if (activeTool === 'trendline') {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'trendline',
          p1,
          p2,
          color: '#00d2ff',
        });
      } else if (activeTool === 'rectangle') {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'rectangle',
          p1,
          p2,
          color: '#f59e0b',
        });
      } else if (activeTool === 'circle') {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'circle',
          center: p1,
          edge: p2,
          color: '#a855f7',
        });
      }

      setDrawingStartPoint(null);
      setActiveTool('cursor');
    }
  };

  const handleSaveTextAnnotation = () => {
    if (textInputPos && textInputValue.trim()) {
      addDrawing({
        id: crypto.randomUUID(),
        type: 'text',
        point: textInputPos.point,
        text: textInputValue.trim(),
        color: '#fde047',
      });
    }
    setTextInputPos(null);
    setTextInputValue('');
    setActiveTool('cursor');
  };

  const handleExecutePositionOrder = (d: PositionToolDrawing) => {
    const isLong = d.type === 'long_position';
    const success = openOrder({
      side: isLong ? 'LONG' : 'SHORT',
      quantity: d.quantity || 1,
      stopLoss: d.stopLossPrice,
      takeProfit: d.takeProfitPrice,
    });

    if (success) {
      setOrderNotice(`✓ Executed ${isLong ? 'LONG' : 'SHORT'} 1oz @ ${d.entryPoint.price.toFixed(2)}`);
      setTimeout(() => setOrderNotice(null), 3500);
    }
  };

  // Display Candle Legend
  const activeCandle = hoveredCandle || currentCandle;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePercent = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  const isInteractiveToolActive = activeTool !== 'cursor';

  return (
    <div className="relative flex-1 w-full h-full min-h-[460px] bg-[#090b10] select-none overflow-hidden flex flex-col">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <span className="font-extrabold text-7xl md:text-9xl text-white tracking-widest font-mono">
          XAUUSD
        </span>
      </div>

      {/* Top Floating HUD Bar */}
      <div className="absolute top-3 left-4 z-20 flex flex-wrap items-center gap-2.5 bg-[#0d111a]/90 backdrop-blur-md border border-[#1e273a] px-3.5 py-1.5 rounded-lg text-xs shadow-lg">
        {/* Ticker & Timeframe */}
        <div className="flex items-center space-x-1.5 font-bold">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-white tracking-wide">XAUUSD</span>
          <span className="text-[10px] bg-[#161d2d] text-amber-400 border border-amber-500/30 px-1 rounded font-mono">
            {currentTimeframe.toUpperCase()}
          </span>
        </div>

        {/* Live Market vs Backtest Mode Badge */}
        {isLiveMode ? (
          <div className="flex items-center space-x-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase animate-pulse">
            <Radio className="h-3 w-3 animate-spin" />
            <span>LIVE</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="bg-amber-500/15 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
              REPLAY BACKTEST
            </span>
            <button
              onClick={returnToLive}
              title="Return to real-time live market"
              className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm shadow-emerald-900/50"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
              <span>Jump to Live</span>
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-[#1e273a]" />

        {/* OHLC Readings */}
        {activeCandle ? (
          <div className="flex items-center space-x-2.5 font-mono text-[11px] tabular-nums">
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
          <span className="text-neutral-500 italic text-[11px]">Connecting to XAUUSD feed...</span>
        )}
      </div>

      {/* Floating Instructions Banner when a tool is active */}
      {isInteractiveToolActive && (
        <div className="absolute top-12 left-4 z-20 flex items-center space-x-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-md text-[11px] font-medium shadow-lg backdrop-blur-md animate-fadeIn">
          {activeTool === 'bar_replay' && (
            <>
              <Scissors className="h-3.5 w-3.5 text-amber-400" />
              <span>Click any candlestick on the chart to cut future data and begin backtest</span>
            </>
          )}
          {activeTool === 'long_position' && (
            <>
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Click on chart to place TradingView Long Position Risk/Reward box</span>
            </>
          )}
          {activeTool === 'short_position' && (
            <>
              <Zap className="h-3.5 w-3.5 text-rose-400" />
              <span>Click on chart to place TradingView Short Position Risk/Reward box</span>
            </>
          )}
          {activeTool === 'trendline' && (
            <span>Trendline: {drawingStartPoint ? 'Click second point to finish' : 'Click start point'}</span>
          )}
          {activeTool === 'rectangle' && (
            <span>Rectangle: {drawingStartPoint ? 'Click corner point to finish' : 'Click first corner'}</span>
          )}
          {activeTool === 'circle' && (
            <span>Circle: {drawingStartPoint ? 'Click radius edge to finish' : 'Click center point'}</span>
          )}
          {activeTool === 'horizontal_line' && (
            <span>Click on price level to place Horizontal Line</span>
          )}
          {activeTool === 'text' && (
            <span>Click where you want to add text annotation</span>
          )}
          <button
            onClick={() => {
              setActiveTool('cursor');
              setDrawingStartPoint(null);
            }}
            className="ml-2 hover:bg-amber-500/20 rounded p-0.5 text-amber-200 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Order Placement Toast / Notice */}
      {orderNotice && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-emerald-600/90 border border-emerald-400/50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md flex items-center space-x-2 animate-bounce">
          <Zap className="h-4 w-4" />
          <span>{orderNotice}</span>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" />

      {/* SVG Interactive Drawing Layer */}
      <svg
        aria-label="Interactive Chart Drawings"
        onMouseMove={handleOverlayMouseMove}
        onMouseLeave={handleOverlayMouseLeave}
        onClick={handleOverlayClick}
        className={`absolute inset-0 w-full h-full z-10 ${
          isInteractiveToolActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Render Saved Drawings from pre-computed projected state */}
        {projectedDrawings.map((d) => {
          if (d.type === 'horizontal_line' && d.y !== undefined && d.price !== undefined) {
            return (
              <g key={d.id} className="pointer-events-auto group">
                <line
                  x1="0"
                  y1={d.y}
                  x2="100%"
                  y2={d.y}
                  stroke={d.color || '#38bdf8'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <rect
                  x="10"
                  y={d.y - 10}
                  width="70"
                  height="20"
                  rx="4"
                  fill="#10141f"
                  stroke={d.color || '#38bdf8'}
                  strokeWidth="1"
                />
                <text
                  x="45"
                  y={d.y + 3.5}
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {d.price.toFixed(2)}
                </text>
                <circle
                  cx="100"
                  cy={d.y}
                  r="7"
                  className="fill-rose-500/80 hover:fill-rose-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDrawing(d.id);
                  }}
                />
              </g>
            );
          }

          if (d.type === 'trendline' && d.p1 && d.p2) {
            return (
              <g key={d.id} className="pointer-events-auto group">
                <line
                  x1={d.p1.x}
                  y1={d.p1.y}
                  x2={d.p2.x}
                  y2={d.p2.y}
                  stroke={d.color || '#00d2ff'}
                  strokeWidth="2"
                />
                <circle cx={d.p1.x} cy={d.p1.y} r="3.5" fill={d.color || '#00d2ff'} />
                <circle cx={d.p2.x} cy={d.p2.y} r="3.5" fill={d.color || '#00d2ff'} />
              </g>
            );
          }

          if (d.type === 'rectangle' && d.rect) {
            return (
              <g key={d.id} className="pointer-events-auto">
                <rect
                  x={d.rect.x}
                  y={d.rect.y}
                  width={d.rect.width}
                  height={d.rect.height}
                  fill="rgba(245, 158, 11, 0.12)"
                  stroke={d.color || '#f59e0b'}
                  strokeWidth="1.5"
                />
              </g>
            );
          }

          if (d.type === 'circle' && d.circle) {
            return (
              <g key={d.id} className="pointer-events-auto">
                <ellipse
                  cx={d.circle.cx}
                  cy={d.circle.cy}
                  rx={d.circle.radius}
                  ry={d.circle.radius}
                  fill="rgba(168, 85, 247, 0.12)"
                  stroke={d.color || '#a855f7'}
                  strokeWidth="1.5"
                />
              </g>
            );
          }

          if (d.type === 'text' && d.text) {
            return (
              <g key={d.id} transform={`translate(${d.text.x}, ${d.text.y})`} className="pointer-events-auto group">
                <rect
                  x="0"
                  y="-18"
                  width={d.text.text.length * 7 + 16}
                  height="22"
                  rx="4"
                  fill="#161b26"
                  stroke={d.color || '#fde047'}
                  strokeWidth="1"
                />
                <text x="8" y="-3" fill="#ffffff" fontSize="11" fontWeight="600">
                  {d.text.text}
                </text>
              </g>
            );
          }

          // TradingView Premium Long/Short Position Tool
          if ((d.type === 'long_position' || d.type === 'short_position') && d.position) {
            const pos = d.position;

            return (
              <g key={d.id} className="pointer-events-auto">
                {/* Green Target Zone */}
                <rect
                  x={pos.startX}
                  y={pos.targetZoneTop}
                  width={pos.boxWidth}
                  height={pos.targetZoneHeight}
                  fill="rgba(8, 153, 129, 0.22)"
                  stroke="#089981"
                  strokeWidth="1.5"
                />

                {/* Red Stop Loss Zone */}
                <rect
                  x={pos.startX}
                  y={pos.stopZoneTop}
                  width={pos.boxWidth}
                  height={pos.stopZoneHeight}
                  fill="rgba(242, 54, 69, 0.22)"
                  stroke="#f23645"
                  strokeWidth="1.5"
                />

                {/* Center Entry Line */}
                <line
                  x1={pos.startX}
                  y1={pos.entryY}
                  x2={pos.startX + pos.boxWidth}
                  y2={pos.entryY}
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />

                {/* Target Price Label */}
                <text
                  x={pos.startX + 6}
                  y={pos.targetZoneTop + 14}
                  fill="#34d399"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  TP: {pos.tpPrice.toFixed(2)} (+${pos.rewardPts.toFixed(2)})
                </text>

                {/* Stop Price Label */}
                <text
                  x={pos.startX + 6}
                  y={pos.stopZoneTop + pos.stopZoneHeight - 6}
                  fill="#f87171"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  SL: {pos.slPrice.toFixed(2)} (-${pos.riskPts.toFixed(2)})
                </text>

                {/* R:R Ratio Badge & Execute Button on Box */}
                <foreignObject
                  x={pos.startX + 4}
                  y={pos.entryY - 14}
                  width={pos.boxWidth - 8}
                  height="28"
                  className="overflow-visible"
                >
                  <div className="flex items-center justify-between gap-1 bg-[#0d121c]/90 border border-[#232b3d] px-2 py-0.5 rounded shadow-lg backdrop-blur-sm text-[10px]">
                    <span className="font-bold text-amber-300 font-mono">
                      R:R {pos.rrRatio}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecutePositionOrder(pos.raw);
                      }}
                      title="Place simulated order with these SL/TP levels"
                      className={`flex items-center space-x-1 px-1.5 py-0.2 rounded font-bold text-white transition-all cursor-pointer ${
                        pos.isLong
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-900/60'
                          : 'bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-900/60'
                      }`}
                    >
                      <Zap className="h-2.5 w-2.5 fill-current" />
                      <span>{pos.isLong ? 'Buy' : 'Sell'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDrawing(d.id);
                      }}
                      className="text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          }

          return null;
        })}

        {/* Live Bar Replay Cutting Guide Line */}
        {activeTool === 'bar_replay' && currentMousePoint && (
          <g className="pointer-events-none">
            <line
              x1={currentMousePoint.x}
              y1="0"
              x2={currentMousePoint.x}
              y2="100%"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <rect
              x={currentMousePoint.x - 70}
              y="15"
              width="140"
              height="24"
              rx="6"
              fill="#161b26"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <text
              x={currentMousePoint.x}
              y="31"
              fill="#fbbf24"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="bold"
              textAnchor="middle"
            >
              ✂️ Click to Cut Here
            </text>
          </g>
        )}

        {/* In-progress Multi-point Preview (Trendline, Rect, Circle) from projectedPreview */}
        {projectedPreview && (
          <g className="pointer-events-none">
            {projectedPreview.trendline && (
              <line
                x1={projectedPreview.trendline.x1}
                y1={projectedPreview.trendline.y1}
                x2={projectedPreview.trendline.x2}
                y2={projectedPreview.trendline.y2}
                stroke="#00d2ff"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
            )}

            {projectedPreview.rectangle && (
              <rect
                x={projectedPreview.rectangle.x}
                y={projectedPreview.rectangle.y}
                width={projectedPreview.rectangle.width}
                height={projectedPreview.rectangle.height}
                fill="rgba(245, 158, 11, 0.15)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            )}

            {projectedPreview.circle && (
              <ellipse
                cx={projectedPreview.circle.cx}
                cy={projectedPreview.circle.cy}
                rx={projectedPreview.circle.radius}
                ry={projectedPreview.circle.radius}
                fill="rgba(168, 85, 247, 0.15)"
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            )}
          </g>
        )}
      </svg>

      {/* Inline Text Input Dialog for Text Tool */}
      {textInputPos && (
        <div
          style={{ left: textInputPos.x, top: textInputPos.y }}
          className="absolute z-30 bg-[#141926] border border-amber-500/50 p-2 rounded-lg shadow-2xl backdrop-blur-md flex items-center space-x-2"
        >
          <input
            type="text"
            autoFocus
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTextAnnotation();
              if (e.key === 'Escape') setTextInputPos(null);
            }}
            placeholder="Annotation text..."
            className="bg-[#0b0e14] border border-[#232b3d] px-2 py-1 text-xs text-white rounded outline-none focus:border-amber-500 w-44 font-mono"
          />
          <button
            onClick={handleSaveTextAnnotation}
            className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer"
          >
            Add
          </button>
          <button
            onClick={() => setTextInputPos(null)}
            className="text-neutral-400 hover:text-white text-xs cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
    </div>
  );
};
