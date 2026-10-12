'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import type { Candle } from '@/types';
import { DataPoint, ToolType } from '@/types/drawings';
import { DragState } from '@/components/chart/chartTypes';
import { ChartHud } from '@/components/chart/ChartHud';
import { useChartDrawingProjection } from '@/components/chart/useChartDrawingProjection';
import { ChartDrawingItems } from '@/components/chart/ChartDrawingItems';
import { SelectedDrawingToolbar } from '@/components/chart/SelectedDrawingToolbar';
import { useChartInteractions } from '@/components/chart/useChartInteractions';
import { useChartLifecycle } from '@/components/chart/useChartLifecycle';
import { useChartCoordinates } from '@/components/chart/useChartCoordinates';
import { useChartMarketClock } from '@/components/chart/useChartMarketClock';
import { useChartIndicatorSettings } from '@/components/chart/useChartIndicatorSettings';
import { ChartIndicatorSettings } from '@/components/chart/ChartIndicatorSettings';
import { FairValueGapOverlay } from '@/components/chart/FairValueGapOverlay';
import {
  Activity,
  X,
  Zap,
} from 'lucide-react';

export const Chart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);

  // Active price lines

  // Store data
  const candles = useTradingSimulatorStore((s) => s.candles);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const openPosition = useTradingSimulatorStore((s) => s.openPosition);
  const orderPreview = useTradingSimulatorStore((s) => s.orderPreview);
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
  const updateDrawing = useTradingSimulatorStore((s) => s.updateDrawing);
  const removeDrawing = useTradingSimulatorStore((s) => s.removeDrawing);
  const reorderDrawing = useTradingSimulatorStore((s) => s.reorderDrawing);
  const toggleHideDrawing = useTradingSimulatorStore((s) => s.toggleHideDrawing);
  const returnToLive = useTradingSimulatorStore((s) => s.returnToLive);

  // Interactive drawing creation state
  const [drawingStartPoint, setDrawingStartPoint] = useState<DataPoint | null>(null);
  const [drawingStartTool, setDrawingStartTool] = useState<ToolType | null>(null);
  const [currentMousePoint, setCurrentMousePoint] = useState<{ x: number; y: number; time: number; price: number } | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFontSize, setTextFontSize] = useState(14);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Dragging and resizing state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Force re-projection key when chart zooms/pans
  const [viewportKey, setViewportKey] = useState(0);

  // Track prev index to decide whether to update single candle or setData

  // Hovered candle for OHLC legend
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [chartTheme, setChartTheme] = useState({
    upColor: '#089981',
    downColor: '#f23645',
    wickUpColor: '#089981',
    wickDownColor: '#f23645',
    borderUpColor: '#089981',
    borderDownColor: '#f23645',
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const {
    settings,
    setBreakoutEnabled,
    updateBreakoutConfig,
    setFairValueGapEnabled,
    updateFairValueGapConfig,
  } = useChartIndicatorSettings();
  const {
    sessionCountdown,
    sessionAction,
    candleCountdown,
    isMarketOpen,
  } = useChartMarketClock({ currentCandle, currentTimeframe, isLiveMode });

  useChartLifecycle({
    containerRef, chartRef, seriesRef, chartTheme, setHoveredCandle, setViewportKey,
    candles, currentIndex, isLiveMode, currentCandle, openPosition, tradeHistory,
    candleCountdown, isMarketOpen,
    breakoutEnabled: settings.breakoutEnabled,
    breakoutConfig: settings.breakout,
    currentTimeframe,
  });

  useEffect(() => {
    void useTradingSimulatorStore.persist.rehydrate();
  }, []);

  // Real-time live market polling interval (every 2.5s)
  useEffect(() => {
    if (!isLiveMode) return;

    let isMounted = true;
    let isRequestInFlight = false;
    const pollLive = async () => {
      if (isRequestInFlight) return;
      isRequestInFlight = true;
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
      } finally {
        isRequestInFlight = false;
      }
    };

    void pollLive();
    const intervalId = setInterval(pollLive, 1000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isLiveMode, currentTimeframe, updateLiveCandles]);

  const getChartDataPoint = useChartCoordinates({
    chartRef,
    seriesRef,
    containerRef,
    currentCandle,
    currentIndex,
    currentTimeframe,
  });

  const {
    handleOverlayMouseDown,
    handleOverlayMouseMove,
    handleOverlayMouseUp,
    handleOverlayMouseLeave,
    handleOverlayClick,
    startDrag,
    handleSaveTextAnnotation,
    cancelTextAnnotation,
    handleDrawingDoubleClick,
    handleTextDoubleClick,
    handleExecutePositionOrder,
  } = useChartInteractions({
    activeTool,
    drawingStartPoint,
    setDrawingStartPoint,
    drawingStartTool,
    setDrawingStartTool,
    setCurrentMousePoint,
    dragState,
    setDragState,
    getChartDataPoint,
    textInputPos,
    setTextInputPos,
    textInputValue,
    setTextInputValue,
    textColor,
    setTextColor,
    textFontSize,
    setTextFontSize,
    editingTextId,
    setEditingTextId,
    setOrderNotice,
  });

  const { projectedDrawings, projectedPreview } = useChartDrawingProjection({
    chartRef, seriesRef, drawings, orderPreview, currentCandle, currentTimeframe,
    currentIndex, viewportKey, drawingStartPoint, drawingStartTool, currentMousePoint,
    activeTool, candles,
  });

  // Keyboard shortcuts for deleting drawings and cancelling the current tool.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (textInputPos) {
          setTextInputPos(null);
          setTextInputValue('');
          setActiveTool('cursor');
        } else if (drawingStartPoint || activeTool !== 'cursor') {
          setDrawingStartTool(null);
          setDrawingStartPoint(null);
          setActiveTool('cursor');
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        }
        return;
      }

      if (selectedDrawingId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeDrawing(selectedDrawingId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    drawingStartPoint,
    removeDrawing,
    selectedDrawingId,
    setActiveTool,
    setSelectedDrawingId,
    textInputPos,
  ]);

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

  // Selected drawing for floating toolbar
  const selectedProjected = projectedDrawings.find((d) => d.id === selectedDrawingId);

  // Display Candle Legend
  const activeCandle = hoveredCandle || currentCandle;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePercent = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  const isInteractiveToolActive = activeTool !== 'cursor';
  const activeToolInstruction = activeTool === 'bar_replay'
    ? 'Click a candle to set the replay start. Esc to cancel.'
    : activeTool === 'long_position' || activeTool === 'short_position'
      ? 'Click the chart to place the position tool. Esc to cancel.'
      : activeTool === 'horizontal_line'
        ? 'Click a price level to place a horizontal line. Esc to cancel.'
        : activeTool === 'text'
          ? 'Click the chart to add a text note. Esc to cancel.'
          : activeTool === 'cursor'
            ? ''
            : drawingStartPoint && drawingStartTool === activeTool
              ? 'Click a second point to finish. Esc to cancel.'
              : 'Click the chart to set the first point. Esc to cancel.';
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

      <ChartHud
        timeframe={currentTimeframe}
        isLiveMode={isLiveMode}
        onReturnToLive={returnToLive}
        isLoadingOlderData={isLoadingOlderData}
        hasReachedBeginning={hasReachedBeginning}
        activeCandle={activeCandle}
        priceChange={priceChange}
        priceChangePercent={priceChangePercent}
        isUp={isUp}
        sessionCountdown={sessionCountdown}
        sessionAction={sessionAction}
        activeTool={activeTool}
        activeToolInstruction={activeToolInstruction}
        onCancelTool={() => {
          setDrawingStartTool(null);
          setActiveTool('cursor');
          setDrawingStartPoint(null);
        }}
      />

      <ChartIndicatorSettings
        breakoutEnabled={settings.breakoutEnabled}
        breakoutConfig={settings.breakout}
        fairValueGapEnabled={settings.fairValueGapEnabled}
        fairValueGapConfig={settings.fairValueGap}
        onToggleBreakout={setBreakoutEnabled}
        onUpdateBreakoutConfig={updateBreakoutConfig}
        onToggleFairValueGap={setFairValueGapEnabled}
        onUpdateFairValueGapConfig={updateFairValueGapConfig}
      />

      <SelectedDrawingToolbar
        selectedDrawing={selectedProjected}
        isInteractiveToolActive={isInteractiveToolActive}
        toggleHideDrawing={toggleHideDrawing}
        reorderDrawing={reorderDrawing}
        updateDrawing={(id, updates) => updateDrawing(id, updates)}
        removeDrawing={removeDrawing}
      />
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
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative"
        onClick={() => setSelectedDrawingId(null)}
      />

      {/* SVG Interactive Drawing Layer */}
      <svg
        aria-label="Interactive Chart Drawings"
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseLeave}
        onClick={handleOverlayClick}
        className={`absolute inset-0 w-full h-full z-10 ${
          isInteractiveToolActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <FairValueGapOverlay
          chartRef={chartRef}
          seriesRef={seriesRef}
          candles={candles}
          currentIndex={currentIndex}
          isLiveMode={isLiveMode}
          currentTimeframe={currentTimeframe}
          viewportKey={viewportKey}
          enabled={settings.fairValueGapEnabled}
          config={settings.fairValueGap}
          breakoutConfig={settings.breakout}
        />
        <ChartDrawingItems
          projectedDrawings={projectedDrawings}
          selectedDrawingId={selectedDrawingId}
          activeTool={activeTool}
          setSelectedDrawingId={setSelectedDrawingId}
          startDrag={startDrag}
          handleDrawingDoubleClick={handleDrawingDoubleClick}
          handleTextDoubleClick={handleTextDoubleClick}
          handleExecutePositionOrder={handleExecutePositionOrder}
          removeDrawing={removeDrawing}
        />
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
          className="absolute z-30 flex items-center gap-2 rounded border border-[#303844] bg-[#101318] p-2 shadow-xl"
        >
          <input
            type="text"
            autoFocus
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTextAnnotation();
              if (e.key === 'Escape') cancelTextAnnotation();
            }}
            placeholder="Text"
            aria-label="Annotation text"
            className="w-36 rounded border border-[#303844] bg-[#0b0e14] px-2 py-1.5 text-sm text-white outline-none focus:border-neutral-400"
          />
          <label className="flex items-center gap-1 text-xs text-neutral-400" title="Font size">
            <span>Size</span>
            <select
              value={textFontSize}
              onChange={(e) => setTextFontSize(Number(e.target.value))}
              aria-label="Font size"
              className="rounded border border-[#303844] bg-[#0b0e14] px-1.5 py-1.5 text-xs text-neutral-100"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-neutral-400" title="Text color">
            <span>Color</span>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              aria-label="Text color"
              className="h-7 w-8 cursor-pointer rounded border border-[#303844] bg-transparent p-0.5"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveTextAnnotation}
            className="rounded bg-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            {editingTextId ? 'Save' : 'Add'}
          </button>
          <button
            type="button"
            aria-label="Cancel text annotation"
            onClick={cancelTextAnnotation}
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
