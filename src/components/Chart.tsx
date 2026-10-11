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
  TickMarkType,
} from 'lightweight-charts';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { Candle } from '@/types';
import { DataPoint, PositionToolDrawing, ToolType, Drawing } from '@/types/drawings';
import {
  getSessionInfo,
  getNextMarketSessionBoundary,
  formatTickMarkAmPm,
  formatCrosshairTimeWithSession,
} from '@/lib/utils/sessions';
import {
  Activity,
  Radio,
  Scissors,
  Play,
  X,
  Zap,
  Eye,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  Clock3,
} from 'lucide-react';

const TIMEFRAME_SECONDS: Record<string, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '1d': 86400,
};

const formatCountdown = (totalSeconds: number, showDays = false) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const dayPrefix = showDays && days > 0 ? `${days}d ` : '';
  return `${dayPrefix}${[hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':')}`;
};

interface ProjectedDrawing {
  id: string;
  type: ToolType;
  color?: string;
  hidden?: boolean;
  raw: Drawing;

  // Selected toolbar coordinates
  anchor: { x: number; y: number };

  // For trendline
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };

  // For horizontal_line
  y?: number;
  price?: number;

  // For rectangle
  rect?: { x: number; y: number; width: number; height: number };
  corners?: {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  };

  // For circle
  circle?: { cx: number; cy: number; radius: number };
  centerHandle?: { x: number; y: number };
  edgeHandle?: { x: number; y: number };

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
    entryPrice: number;
    tpHandle: { x: number; y: number };
    slHandle: { x: number; y: number };
    entryHandle: { x: number; y: number };
    rightHandle: { x: number; y: number };
    rawPos: PositionToolDrawing;
  };
}

interface ProjectedPreview {
  trendline?: { x1: number; y1: number; x2: number; y2: number };
  rectangle?: { x: number; y: number; width: number; height: number };
  circle?: { cx: number; cy: number; radius: number };
}

interface DragState {
  mode: 'move' | 'resize';
  drawingId: string;
  handle?: string;
  startClientX: number;
  startClientY: number;
  startPoint: DataPoint;
  initialDrawing: Drawing;
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
  const candleCloseLineRef = useRef<IPriceLine | null>(null);

  // Store data
  const candles = useTradingSimulatorStore((s) => s.candles);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const openPosition = useTradingSimulatorStore((s) => s.openPosition);
  const tradeHistory = useTradingSimulatorStore((s) => s.tradeHistory);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);
  const updateLiveCandles = useTradingSimulatorStore((s) => s.updateLiveCandles);

  // Infinite Scrollback
  const isLoadingOlderData = useTradingSimulatorStore((s) => s.isLoadingOlderData);
  const hasReachedBeginning = useTradingSimulatorStore((s) => s.hasReachedBeginning);

  // Tools & Drawings
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);
  const drawings = useTradingSimulatorStore((s) => s.drawings);
  const selectedDrawingId = useTradingSimulatorStore((s) => s.selectedDrawingId);
  const setSelectedDrawingId = useTradingSimulatorStore((s) => s.setSelectedDrawingId);
  const addDrawing = useTradingSimulatorStore((s) => s.addDrawing);
  const updateDrawing = useTradingSimulatorStore((s) => s.updateDrawing);
  const removeDrawing = useTradingSimulatorStore((s) => s.removeDrawing);
  const reorderDrawing = useTradingSimulatorStore((s) => s.reorderDrawing);
  const toggleHideDrawing = useTradingSimulatorStore((s) => s.toggleHideDrawing);
  const cutToBar = useTradingSimulatorStore((s) => s.cutToBar);
  const returnToLive = useTradingSimulatorStore((s) => s.returnToLive);
  const openOrder = useTradingSimulatorStore((s) => s.openOrder);

  // Interactive drawing creation state
  const [drawingStartPoint, setDrawingStartPoint] = useState<DataPoint | null>(null);
  const [currentMousePoint, setCurrentMousePoint] = useState<{ x: number; y: number; time: number; price: number } | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Dragging and resizing state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Projected SVG coordinates (computed in effect, not in render)
  const [projectedDrawings, setProjectedDrawings] = useState<ProjectedDrawing[]>([]);
  const [projectedPreview, setProjectedPreview] = useState<ProjectedPreview | null>(null);

  // Force re-projection key when chart zooms/pans
  const [viewportKey, setViewportKey] = useState(0);

  // Track prev index to decide whether to update single candle or setData
  const prevIndexRef = useRef<number>(-1);
  const replayAnimationFrameRef = useRef<number | null>(null);

  // Hovered candle for OHLC legend
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);

  const [chartTheme, setChartTheme] = useState({
    upColor: '#089981',
    downColor: '#f23645',
    wickUpColor: '#089981',
    wickDownColor: '#f23645',
    borderUpColor: '#089981',
    borderDownColor: '#f23645',
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setClockNow(Date.now());
    const intervalId = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

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
      upColor: chartTheme.upColor,
      downColor: chartTheme.downColor,
      borderVisible: false,
      wickUpColor: chartTheme.wickUpColor,
      wickDownColor: chartTheme.wickDownColor,
      borderUpColor: chartTheme.borderUpColor,
      borderDownColor: chartTheme.borderDownColor,
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
  }, []);

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
  }, [chartTheme]);

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
      return;
    }

    const prevIndex = prevIndexRef.current;
    const isSingleStepForward = currentIndex === prevIndex + 1 && prevIndex >= 0;

    if (isSingleStepForward) {
      const previousCandle = candles[currentIndex - 1];
      const nextCandle = candles[currentIndex];
      const durationMs = 220;
      const startTime = performance.now();

      if (replayAnimationFrameRef.current !== null) {
        cancelAnimationFrame(replayAnimationFrameRef.current);
      }

      const animateCandle = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - (1 - progress) ** 3;

        series.update({
          time: nextCandle.timestamp as UTCTimestamp,
          open: previousCandle.open + (nextCandle.open - previousCandle.open) * eased,
          high: previousCandle.high + (nextCandle.high - previousCandle.high) * eased,
          low: previousCandle.low + (nextCandle.low - previousCandle.low) * eased,
          close: previousCandle.close + (nextCandle.close - previousCandle.close) * eased,
        });

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
            hidden: d.hidden,
            raw: d,
            anchor: { x: 90, y },
            y,
            price: d.price,
          });
        }
      } else if (d.type === 'trendline') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) },
            p1,
            p2,
          });
        }
      } else if (d.type === 'rectangle') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: minX, y: minY },
            rect: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            corners: {
              tl: { x: minX, y: minY },
              tr: { x: maxX, y: minY },
              br: { x: maxX, y: maxY },
              bl: { x: minX, y: maxY },
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
            hidden: d.hidden,
            raw: d,
            anchor: { x: center.x, y: center.y - radius },
            circle: { cx: center.x, cy: center.y, radius },
            centerHandle: center,
            edgeHandle: { x: center.x + radius, y: center.y },
          });
        }
      } else if (d.type === 'text') {
        const pt = toCoords(d.point);
        if (pt) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: pt,
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
            hidden: d.hidden,
            raw: d,
            anchor: { x: startX, y: Math.min(targetZoneTop, stopZoneTop) },
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
              entryPrice: d.entryPoint.price,
              tpHandle: { x: startX + boxWidth / 2, y: tpY },
              slHandle: { x: startX + boxWidth / 2, y: slY },
              entryHandle: { x: startX + boxWidth / 2, y: entryY },
              rightHandle: { x: startX + boxWidth, y: entryY },
              rawPos: d,
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

  // Keyboard shortcut listener for selected drawing (Delete / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (selectedDrawingId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeDrawing(selectedDrawingId);
        } else if (e.key === 'Escape') {
          setSelectedDrawingId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, removeDrawing, setSelectedDrawingId]);

  const handleResetChartView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  // Mouse interaction handler on SVG overlay
  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;
    setCurrentMousePoint(pt);

    // Active drag handling for moving or resizing drawings
    if (dragState) {
      const currentPoint: DataPoint = { time: pt.time, price: pt.price };
      const deltaPrice = currentPoint.price - dragState.startPoint.price;
      const deltaTime = currentPoint.time - dragState.startPoint.time;
      const init = dragState.initialDrawing;

      if (dragState.mode === 'move') {
        if (init.type === 'trendline') {
          updateDrawing(dragState.drawingId, {
            p1: { time: init.p1.time + deltaTime, price: init.p1.price + deltaPrice },
            p2: { time: init.p2.time + deltaTime, price: init.p2.price + deltaPrice },
          });
        } else if (init.type === 'horizontal_line') {
          updateDrawing(dragState.drawingId, {
            price: init.price + deltaPrice,
          });
        } else if (init.type === 'rectangle') {
          updateDrawing(dragState.drawingId, {
            p1: { time: init.p1.time + deltaTime, price: init.p1.price + deltaPrice },
            p2: { time: init.p2.time + deltaTime, price: init.p2.price + deltaPrice },
          });
        } else if (init.type === 'circle') {
          updateDrawing(dragState.drawingId, {
            center: { time: init.center.time + deltaTime, price: init.center.price + deltaPrice },
            edge: { time: init.edge.time + deltaTime, price: init.edge.price + deltaPrice },
          });
        } else if (init.type === 'text') {
          updateDrawing(dragState.drawingId, {
            point: { time: init.point.time + deltaTime, price: init.point.price + deltaPrice },
          });
        } else if (init.type === 'long_position' || init.type === 'short_position') {
          updateDrawing(dragState.drawingId, {
            entryPoint: { time: init.entryPoint.time + deltaTime, price: init.entryPoint.price + deltaPrice },
            stopLossPrice: init.stopLossPrice + deltaPrice,
            takeProfitPrice: init.takeProfitPrice + deltaPrice,
            targetTime: init.targetTime !== undefined ? init.targetTime + deltaTime : undefined,
          });
        }
      } else if (dragState.mode === 'resize') {
        const handle = dragState.handle;

        // Rectangle corners
        if (init.type === 'rectangle') {
          if (handle === 'tl') {
            updateDrawing(dragState.drawingId, {
              p1: { time: currentPoint.time, price: currentPoint.price },
            });
          } else if (handle === 'br') {
            updateDrawing(dragState.drawingId, {
              p2: { time: currentPoint.time, price: currentPoint.price },
            });
          } else if (handle === 'tr') {
            updateDrawing(dragState.drawingId, {
              p1: { time: init.p1.time, price: currentPoint.price },
              p2: { time: currentPoint.time, price: init.p2.price },
            });
          } else if (handle === 'bl') {
            updateDrawing(dragState.drawingId, {
              p1: { time: currentPoint.time, price: init.p1.price },
              p2: { time: init.p2.time, price: currentPoint.price },
            });
          }
        } else if (init.type === 'circle') {
          if (handle === 'center') {
            updateDrawing(dragState.drawingId, { center: currentPoint });
          } else if (handle === 'edge') {
            updateDrawing(dragState.drawingId, { edge: currentPoint });
          }
        } else if (init.type === 'trendline') {
          if (handle === 'p1') {
            updateDrawing(dragState.drawingId, { p1: currentPoint });
          } else if (handle === 'p2') {
            updateDrawing(dragState.drawingId, { p2: currentPoint });
          }
        } else if (init.type === 'long_position' || init.type === 'short_position') {
          if (handle === 'tp') {
            updateDrawing(dragState.drawingId, { takeProfitPrice: currentPoint.price });
          } else if (handle === 'sl') {
            updateDrawing(dragState.drawingId, { stopLossPrice: currentPoint.price });
          } else if (handle === 'entry') {
            updateDrawing(dragState.drawingId, {
              entryPoint: { time: init.entryPoint.time, price: currentPoint.price },
            });
          } else if (handle === 'right') {
            updateDrawing(dragState.drawingId, { targetTime: currentPoint.time });
          }
        }
      }
    }
  };

  const handleOverlayMouseUp = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  const handleOverlayMouseLeave = () => {
    setCurrentMousePoint(null);
    if (dragState) {
      setDragState(null);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (dragState) return;

    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;

    const clickedPoint: DataPoint = { time: pt.time, price: pt.price };

    // If clicking on empty canvas with cursor, deselect drawing
    if (activeTool === 'cursor') {
      setSelectedDrawingId(null);
      return;
    }

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

  const startDrag = (
    e: React.MouseEvent,
    drawingId: string,
    mode: 'move' | 'resize',
    handle?: string
  ) => {
    e.stopPropagation();
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;

    const drawing = drawings.find((d) => d.id === drawingId);
    if (!drawing) return;

    setSelectedDrawingId(drawingId);
    setDragState({
      mode,
      drawingId,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPoint: { time: pt.time, price: pt.price },
      initialDrawing: JSON.parse(JSON.stringify(drawing)),
    });
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

  // Selected drawing for floating toolbar
  const selectedProjected = projectedDrawings.find((d) => d.id === selectedDrawingId);

  // Display Candle Legend
  const activeCandle = hoveredCandle || currentCandle;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePercent = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  const isInteractiveToolActive = activeTool !== 'cursor';
  const currentMarketSession = clockNow === null
    ? null
    : getSessionInfo(Math.floor(clockNow / 1000));
  const sessionBoundary = clockNow === null
    ? null
    : getNextMarketSessionBoundary(new Date(clockNow));
  const sessionSecondsRemaining = sessionBoundary === null
    ? null
    : Math.max(0, Math.ceil((sessionBoundary.timestamp - (clockNow ?? 0)) / 1000));
  const sessionCountdown = sessionSecondsRemaining === null
    ? null
    : formatCountdown(sessionSecondsRemaining, true);
  const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
  const nextCandleClose = clockNow === null
    ? null
    : (Math.floor(clockNow / (timeframeSeconds * 1000)) + 1) * timeframeSeconds * 1000;
  const candleSecondsRemaining = clockNow === null || nextCandleClose === null || !isLiveMode ||
    !currentCandle || !currentMarketSession?.isMarketOpen
    ? null
    : Math.max(0, Math.ceil((nextCandleClose - clockNow) / 1000));
  const candleCountdown = candleSecondsRemaining === null
    ? null
    : formatCountdown(candleSecondsRemaining);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (!candleCountdown || !currentCandle || !isLiveMode || !currentMarketSession?.isMarketOpen) {
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
  }, [candleCountdown, currentCandle, currentMarketSession?.isMarketOpen, isLiveMode]);

  return (
    <div
      className="relative flex-1 w-full h-full min-h-[460px] bg-[#090b10] select-none overflow-hidden flex flex-col"
      onContextMenu={handleContextMenu}
      onClick={handleCloseContextMenu}
    >
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

        {/* Older Historical Candles Loading Indicator */}
        {isLoadingOlderData && (
          <div className="flex items-center space-x-1.5 bg-[#161d2d] text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-medium animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading older candles...</span>
          </div>
        )}

        {hasReachedBeginning && (
          <span className="text-[10px] text-neutral-500 italic">Beginning of historical feed reached</span>
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

        {/* Global Market Session & Open/Close indicator with New York AM/PM */}
        {activeCandle && (
          <>
            <div className="h-4 w-px bg-[#1e273a]" />
            {(() => {
              const session = getSessionInfo(activeCandle.timestamp);
              return session.isMarketOpen ? (
                <div className="flex items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🗽 NY {session.nyTime12}</span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-emerald-400">{session.primarySession}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span className="text-rose-400">MARKET CLOSED ({session.closeReason})</span>
                  <span className="text-neutral-400">•</span>
                  <span>NY {session.nyTime12}</span>
                </div>
              );
            })()}
          </>
        )}
        {sessionCountdown && sessionBoundary && (
          <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${
            sessionBoundary.action === 'opens' ? 'text-amber-300' : 'text-emerald-300'
          }`}>
            <Clock3 className="h-3 w-3" />
            <span>MARKET {sessionBoundary.action.toUpperCase()} IN</span>
            <span className="font-mono text-neutral-100 tabular-nums">{sessionCountdown}</span>
          </div>
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

      {/* Floating Action Context Menu for Selected Drawing (Resize, Move, Delete, Hide, Order, Color) */}
      {selectedProjected && !isInteractiveToolActive && (
        <div
          style={{
            left: Math.max(16, selectedProjected.anchor.x),
            top: Math.max(50, selectedProjected.anchor.y - 48),
          }}
          className="absolute z-30 flex items-center gap-1.5 bg-[#0f1422]/95 border border-[#2b354d] px-2 py-1.5 rounded-xl shadow-2xl backdrop-blur-md animate-fadeIn select-none"
        >
          {/* Hide / Unhide */}
          <button
            type="button"
            onClick={() => toggleHideDrawing(selectedProjected.id)}
            title={selectedProjected.hidden ? 'Show Drawing' : 'Hide Drawing'}
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className={`h-3.5 w-3.5 ${selectedProjected.hidden ? 'text-amber-400' : ''}`} />
          </button>

          {/* Layer Ordering: Send Backward / Bring Forward */}
          <button
            type="button"
            onClick={() => reorderDrawing(selectedProjected.id, 'forward')}
            title="Bring Forward"
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => reorderDrawing(selectedProjected.id, 'backward')}
            title="Send Backward"
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-[#2b354d]" />

          {/* Color Palette Chips */}
          <div className="flex items-center space-x-1">
            {['#00d2ff', '#f59e0b', '#089981', '#f23645', '#a855f7', '#ffffff'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateDrawing(selectedProjected.id, { color: c })}
                style={{ backgroundColor: c }}
                title={`Set color ${c}`}
                className={`w-3.5 h-3.5 rounded-full border border-black/40 hover:scale-125 transition-transform cursor-pointer ${
                  selectedProjected.color === c ? 'ring-2 ring-white scale-110' : ''
                }`}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-[#2b354d]" />

          {/* Delete Drawing */}
          <button
            type="button"
            onClick={() => removeDrawing(selectedProjected.id)}
            title="Delete Drawing [Del]"
            className="p-1 rounded hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
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

      {contextMenu && (
        <div
          className="absolute z-50 min-w-[220px] rounded-xl border border-[#2b354d] bg-[#0f1422]/95 shadow-2xl backdrop-blur-md text-sm text-neutral-200"
          style={{ left: Math.min(contextMenu.x - 120, window.innerWidth - 240), top: Math.min(contextMenu.y + 8, window.innerHeight - 220) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleResetChartView}
            className="w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer border-b border-[#1f2a3d]"
          >
            Reset chart view
          </button>

          <div className="px-3 py-2.5 border-b border-[#1f2a3d]">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-400">Candle colors</div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setChartTheme((prev) => ({ ...prev, upColor: '#089981', wickUpColor: '#089981', borderUpColor: '#089981' }))}
                className="h-5 w-5 rounded-full border border-white/20 bg-[#089981] cursor-pointer"
                title="Green up candles"
              />
              <button
                type="button"
                onClick={() => setChartTheme((prev) => ({ ...prev, downColor: '#f23645', wickDownColor: '#f23645', borderDownColor: '#f23645' }))}
                className="h-5 w-5 rounded-full border border-white/20 bg-[#f23645] cursor-pointer"
                title="Red down candles"
              />
              <button
                type="button"
                onClick={() => setChartTheme((prev) => ({
                  ...prev,
                  upColor: '#22c55e',
                  downColor: '#ef4444',
                  wickUpColor: '#22c55e',
                  wickDownColor: '#ef4444',
                  borderUpColor: '#22c55e',
                  borderDownColor: '#ef4444',
                }))}
                className="h-5 w-5 rounded-full border border-white/20 bg-gradient-to-r from-[#22c55e] to-[#ef4444] cursor-pointer"
                title="Green/red theme"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChartTheme((prev) => ({ ...prev, upColor: '#00d2ff', wickUpColor: '#00d2ff', borderUpColor: '#00d2ff' }))}
                className="h-5 w-5 rounded-full border border-white/20 bg-[#00d2ff] cursor-pointer"
                title="Cyan up candles"
              />
              <button
                type="button"
                onClick={() => setChartTheme((prev) => ({ ...prev, downColor: '#f472b6', wickDownColor: '#f472b6', borderDownColor: '#f472b6' }))}
                className="h-5 w-5 rounded-full border border-white/20 bg-[#f472b6] cursor-pointer"
                title="Pink down candles"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" />

      {/* SVG Interactive Drawing Layer */}
      <svg
        aria-label="Interactive Chart Drawings"
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseLeave}
        onClick={handleOverlayClick}
        className={`absolute inset-0 w-full h-full z-10 ${
          isInteractiveToolActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Render Saved Drawings from pre-computed projected state */}
        {projectedDrawings.map((d) => {
          if (d.hidden) return null;
          const isSelected = d.id === selectedDrawingId;

          if (d.type === 'horizontal_line' && d.y !== undefined && d.price !== undefined) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto group cursor-ns-resize"
                onMouseDown={(e) => startDrag(e, d.id, 'move')}
              >
                <line
                  x1="0"
                  y1={d.y}
                  x2="100%"
                  y2={d.y}
                  stroke={d.color || '#38bdf8'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeDasharray="4 3"
                />
                <rect
                  x="10"
                  y={d.y - 10}
                  width="70"
                  height="20"
                  rx="4"
                  fill="#10141f"
                  stroke={isSelected ? '#ffffff' : (d.color || '#38bdf8')}
                  strokeWidth={isSelected ? '2' : '1'}
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
              </g>
            );
          }

          if (d.type === 'trendline' && d.p1 && d.p2) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Thick invisible hover area for line body dragging */}
                <line
                  x1={d.p1.x}
                  y1={d.p1.y}
                  x2={d.p2.x}
                  y2={d.p2.y}
                  stroke="transparent"
                  strokeWidth="12"
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                />
                <line
                  x1={d.p1.x}
                  y1={d.p1.y}
                  x2={d.p2.x}
                  y2={d.p2.y}
                  stroke={d.color || '#00d2ff'}
                  strokeWidth={isSelected ? '2.5' : '2'}
                />
                {/* Point 1 Resize Handle */}
                <circle
                  cx={d.p1.x}
                  cy={d.p1.y}
                  r={isSelected ? '5.5' : '3.5'}
                  fill={isSelected ? '#ffffff' : (d.color || '#00d2ff')}
                  stroke="#10141f"
                  strokeWidth="1.5"
                  className="cursor-grab hover:scale-125"
                  onMouseDown={(e) => startDrag(e, d.id, 'resize', 'p1')}
                />
                {/* Point 2 Resize Handle */}
                <circle
                  cx={d.p2.x}
                  cy={d.p2.y}
                  r={isSelected ? '5.5' : '3.5'}
                  fill={isSelected ? '#ffffff' : (d.color || '#00d2ff')}
                  stroke="#10141f"
                  strokeWidth="1.5"
                  className="cursor-grab hover:scale-125"
                  onMouseDown={(e) => startDrag(e, d.id, 'resize', 'p2')}
                />
              </g>
            );
          }

          if (d.type === 'rectangle' && d.rect && d.corners) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Rectangle Body (Drag to move) */}
                <rect
                  x={d.rect.x}
                  y={d.rect.y}
                  width={d.rect.width}
                  height={d.rect.height}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke={d.color || '#f59e0b'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeDasharray={isSelected ? '4 2' : undefined}
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                />

                {/* 4 Corner Resize Handles when Selected */}
                {isSelected && (
                  <>
                    <circle
                      cx={d.corners.tl.x}
                      cy={d.corners.tl.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nwse-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tl')}
                    />
                    <circle
                      cx={d.corners.tr.x}
                      cy={d.corners.tr.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nesw-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tr')}
                    />
                    <circle
                      cx={d.corners.br.x}
                      cy={d.corners.br.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nwse-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'br')}
                    />
                    <circle
                      cx={d.corners.bl.x}
                      cy={d.corners.bl.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nesw-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'bl')}
                    />
                  </>
                )}
              </g>
            );
          }

          if (d.type === 'circle' && d.circle && d.centerHandle && d.edgeHandle) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Circle Body (Drag to move) */}
                <ellipse
                  cx={d.circle.cx}
                  cy={d.circle.cy}
                  rx={d.circle.radius}
                  ry={d.circle.radius}
                  fill="rgba(168, 85, 247, 0.15)"
                  stroke={d.color || '#a855f7'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                />

                {/* Handles when Selected */}
                {isSelected && (
                  <>
                    {/* Center Move Handle */}
                    <circle
                      cx={d.centerHandle.x}
                      cy={d.centerHandle.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#a855f7"
                      strokeWidth="2"
                      className="cursor-move hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'center')}
                    />
                    {/* Perimeter Radius Resize Handle */}
                    <circle
                      cx={d.edgeHandle.x}
                      cy={d.edgeHandle.y}
                      r="5.5"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ew-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'edge')}
                    />
                  </>
                )}
              </g>
            );
          }

          if (d.type === 'text' && d.text) {
            return (
              <g
                key={d.id}
                transform={`translate(${d.text.x}, ${d.text.y})`}
                className="pointer-events-auto group cursor-move"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
                onMouseDown={(e) => startDrag(e, d.id, 'move')}
              >
                <rect
                  x="0"
                  y="-18"
                  width={d.text.text.length * 7 + 16}
                  height="22"
                  rx="4"
                  fill="#161b26"
                  stroke={isSelected ? '#ffffff' : (d.color || '#fde047')}
                  strokeWidth={isSelected ? '2' : '1'}
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
              <g
                key={d.id}
                className="pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Green Target Zone */}
                <rect
                  x={pos.startX}
                  y={pos.targetZoneTop}
                  width={pos.boxWidth}
                  height={pos.targetZoneHeight}
                  fill="rgba(8, 153, 129, 0.22)"
                  stroke="#089981"
                  strokeWidth={isSelected ? '2' : '1.5'}
                />

                {/* Red Stop Loss Zone */}
                <rect
                  x={pos.startX}
                  y={pos.stopZoneTop}
                  width={pos.boxWidth}
                  height={pos.stopZoneHeight}
                  fill="rgba(242, 54, 69, 0.22)"
                  stroke="#f23645"
                  strokeWidth={isSelected ? '2' : '1.5'}
                />

                {/* Center Entry Line (Draggable to move entry) */}
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

                {/* Interactive Resize Handles when Selected */}
                {isSelected && (
                  <>
                    {/* TP Handle (Drag to adjust Take Profit) */}
                    <circle
                      cx={pos.tpHandle.x}
                      cy={pos.tpHandle.y}
                      r="5.5"
                      fill="#089981"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ns-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tp')}
                    />
                    {/* SL Handle (Drag to adjust Stop Loss) */}
                    <circle
                      cx={pos.slHandle.x}
                      cy={pos.slHandle.y}
                      r="5.5"
                      fill="#f23645"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ns-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'sl')}
                    />
                    {/* Right Handle (Drag to adjust Width / Target Time) */}
                    <circle
                      cx={pos.rightHandle.x}
                      cy={pos.rightHandle.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#1e273a"
                      strokeWidth="2"
                      className="cursor-ew-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'right')}
                    />
                  </>
                )}

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
                        handleExecutePositionOrder(pos.rawPos);
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
