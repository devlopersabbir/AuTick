import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Candle, ReplayStatus } from '@/types';
import type { ToolType, Drawing } from '@/types/drawings';
import { ReplayEngine } from '@/lib/replay/replay-engine';
import { TradingEngine } from '@/lib/trading/trading-engine';
import type { MarketDataApiResponse } from '@/lib/market-data/types';
import type { TradingSimulatorState } from './tradingSimulatorStoreTypes';

const initialReplayEngine = new ReplayEngine([]);
const initialTradingEngine = new TradingEngine(1000);

export const useTradingSimulatorStore = create<TradingSimulatorState>()(persist((set, get) => {
  // Sync engine tick callback with store state
  const syncFromTick = (candle: Candle, index: number) => {
    const { tradingEngine, replayEngine } = get();

    // Process candle in trading engine for SL/TP evaluation and unrealized P&L
    tradingEngine.processCandle(candle);
    const tradingState = tradingEngine.getState();

    set({
      currentIndex: index,
      currentCandle: candle,
      replayStatus: replayEngine.getStatus(),
      balance: tradingState.balance,
      equity: tradingState.equity,
      openPosition: tradingState.openPosition,
      tradeHistory: tradingState.tradeHistory,
    });
  };

  const syncStatusChange = (status: ReplayStatus) => {
    set({ replayStatus: status });
  };

  initialReplayEngine.subscribe({
    onTick: syncFromTick,
    onStatusChange: syncStatusChange,
  });

  return {
    candles: [],
    metadata: null,
    isLoadingData: false,
    dataError: null,

    isLoadingOlderData: false,
    hasReachedBeginning: false,

    isLiveMode: true,

    currentIndex: -1,
    currentCandle: null,
    replayStatus: 'idle',
    playbackSpeed: 1,

    initialBalance: 1000,
    balance: 1000,
    equity: 1000,
    openPosition: null,
    tradeHistory: [],
    orderError: null,

    activeTool: 'cursor',
    drawings: [],
    selectedDrawingId: null,
    orderPreview: null,

    replayEngine: initialReplayEngine,
    tradingEngine: initialTradingEngine,

    currentTimeframe: '1m',

    fetchMarketData: async ({ startTime, endTime, provider, timeframe }) => {
      const activeTf = timeframe || get().currentTimeframe || '1m';
      set({ isLoadingData: true, dataError: null, currentTimeframe: activeTf, hasReachedBeginning: false });

      try {
        const url = new URL('/api/market-data', window.location.origin);
        url.searchParams.set('startTime', startTime.toString());
        url.searchParams.set('endTime', endTime.toString());
        url.searchParams.set('timeframe', activeTf);
        if (provider) {
          url.searchParams.set('provider', provider);
        }

        const res = await fetch(url.toString());
        const json: MarketDataApiResponse = await res.json();

        if (!json.success || !json.candles || json.candles.length === 0) {
          throw new Error(json.error || 'Failed to fetch historical market data.');
        }

        get().setCandlesDirectly(json.candles, json.metadata!, true);
        set({ isLoadingData: false, dataError: null });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error fetching market data';
        set({ isLoadingData: false, dataError: message });
        return false;
      }
    },

    changeTimeframe: async (timeframe: string) => {
      const { metadata, fetchMarketData } = get();
      if (metadata && metadata.startTime && metadata.endTime) {
        return await fetchMarketData({
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          timeframe,
        });
      } else {
        const nowSec = Math.floor(Date.now() / 1000);
        return await fetchMarketData({
          startTime: nowSec - 24 * 3600,
          endTime: nowSec,
          timeframe,
        });
      }
    },

    fetchOlderCandles: async () => {
      const {
        candles,
        currentTimeframe,
        isLoadingOlderData,
        hasReachedBeginning,
        isLiveMode,
        currentIndex,
        replayEngine,
      } = get();

      if (isLoadingOlderData || hasReachedBeginning || candles.length === 0) {
        return false;
      }

      set({ isLoadingOlderData: true });

      try {
        const oldestCandle = candles[0];
        const url = new URL('/api/market-data', window.location.origin);
        url.searchParams.set('olderThan', oldestCandle.timestamp.toString());
        url.searchParams.set('timeframe', currentTimeframe || '1m');
        url.searchParams.set('limit', '1000');

        const res = await fetch(url.toString());
        const json: MarketDataApiResponse = await res.json();

        if (!json.success || !json.candles || json.candles.length === 0) {
          set({ isLoadingOlderData: false, hasReachedBeginning: true });
          return false;
        }

        const validOlder = json.candles.filter((c) => c.timestamp < oldestCandle.timestamp);
        if (validOlder.length === 0) {
          set({ isLoadingOlderData: false, hasReachedBeginning: true });
          return false;
        }

        const prependedCandles = [...validOlder, ...candles];
        const addedCount = validOlder.length;
        const newIndex = isLiveMode ? prependedCandles.length - 1 : currentIndex + addedCount;

        replayEngine.setDataset(prependedCandles, newIndex);

        set((state) => ({
          candles: prependedCandles,
          currentIndex: newIndex,
          currentCandle: prependedCandles[newIndex] || null,
          metadata: state.metadata
            ? {
                ...state.metadata,
                startTime: prependedCandles[0].timestamp,
                candleCount: prependedCandles.length,
              }
            : null,
          isLoadingOlderData: false,
        }));

        return true;
      } catch {
        set({ isLoadingOlderData: false });
        return false;
      }
    },

    setCandlesDirectly: (candles, metadata, isLive = true) => {
      const { replayEngine, tradingEngine } = get();

      replayEngine.cleanup();
      
      const targetIndex = isLive && candles.length > 0 ? candles.length - 1 : 0;
      const newReplayEngine = new ReplayEngine(candles, targetIndex);

      newReplayEngine.subscribe({
        onTick: syncFromTick,
        onStatusChange: syncStatusChange,
      });

      tradingEngine.reset(get().initialBalance);

      const activeCandle = candles.length > 0 ? candles[targetIndex] : null;

      set({
        candles,
        metadata,
        replayEngine: newReplayEngine,
        tradingEngine,
        isLiveMode: isLive,
        currentIndex: candles.length > 0 ? targetIndex : -1,
        currentCandle: activeCandle,
        replayStatus: isLive ? 'idle' : (candles.length > 0 ? 'paused' : 'idle'),
        balance: get().initialBalance,
        equity: get().initialBalance,
        openPosition: null,
        tradeHistory: [],
        orderError: null,
        hasReachedBeginning: false,
      });
    },

    updateLiveCandles: (incomingCandles: Candle[]) => {
      const { isLiveMode, candles, tradingEngine } = get();
      if (!isLiveMode || incomingCandles.length === 0 || candles.length === 0) return;

      const currentList = [...candles];
      let hasUpdates = false;

      for (const newCandle of incomingCandles) {
        const lastIndex = currentList.length - 1;
        const lastCandle = currentList[lastIndex];

        if (newCandle.timestamp === lastCandle.timestamp) {
          if (
            newCandle.close !== lastCandle.close ||
            newCandle.high !== lastCandle.high ||
            newCandle.low !== lastCandle.low ||
            newCandle.volume !== lastCandle.volume
          ) {
            currentList[lastIndex] = {
              ...lastCandle,
              high: Math.max(lastCandle.high, newCandle.high),
              low: Math.min(lastCandle.low, newCandle.low),
              close: newCandle.close,
              volume: Math.max(lastCandle.volume ?? 0, newCandle.volume ?? 0),
            };
            hasUpdates = true;
          }
        } else if (newCandle.timestamp > lastCandle.timestamp) {
          currentList.push(newCandle);
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        const updatedLastCandle = currentList[currentList.length - 1];
        tradingEngine.processCandle(updatedLastCandle);
        const tradingState = tradingEngine.getState();

        set({
          candles: currentList,
          currentIndex: currentList.length - 1,
          currentCandle: updatedLastCandle,
          balance: tradingState.balance,
          equity: tradingState.equity,
          openPosition: tradingState.openPosition,
          tradeHistory: tradingState.tradeHistory,
        });
      }
    },

    play: () => {
      const { replayEngine, isLiveMode, currentIndex, candles } = get();
      if (isLiveMode || currentIndex >= candles.length - 1) {
        return;
      }
      replayEngine.play();
      set({ replayStatus: replayEngine.getStatus() });
    },

    pause: () => {
      const { replayEngine } = get();
      replayEngine.pause();
      set({ replayStatus: replayEngine.getStatus() });
    },

    stepForward: () => {
      const { replayEngine, isLiveMode } = get();
      if (isLiveMode) return;
      replayEngine.stepForward();
      set({ replayStatus: replayEngine.getStatus() });
    },

    resetReplay: () => {
      const { replayEngine, tradingEngine, candles } = get();
      replayEngine.reset();
      tradingEngine.reset(get().initialBalance);
      const firstCandle = candles[0] || null;

      set({
        currentIndex: candles.length > 0 ? 0 : -1,
        currentCandle: firstCandle,
        replayStatus: replayEngine.getStatus(),
        balance: get().initialBalance,
        equity: get().initialBalance,
        openPosition: null,
        tradeHistory: [],
        orderError: null,
      });
    },

    jumpToTimestamp: (timestamp) => {
      const { replayEngine } = get();
      replayEngine.jumpToTimestamp(timestamp);
      set({ replayStatus: replayEngine.getStatus(), isLiveMode: false });
    },

    cutToBar: (timestamp: number) => {
      const { candles, replayEngine, tradingEngine } = get();
      if (candles.length === 0) return;

      let targetIndex = 0;
      for (let i = 0; i < candles.length; i++) {
        if (candles[i].timestamp <= timestamp) {
          targetIndex = i;
        } else {
          break;
        }
      }

      replayEngine.pause();
      replayEngine.setDataset(candles, targetIndex);
      tradingEngine.reset(get().initialBalance);

      const cutCandle = candles[targetIndex];

      set({
        isLiveMode: false,
        currentIndex: targetIndex,
        currentCandle: cutCandle,
        replayStatus: 'paused',
        activeTool: 'cursor',
        balance: get().initialBalance,
        equity: get().initialBalance,
        openPosition: null,
        tradeHistory: [],
        orderError: null,
      });
    },

    returnToLive: () => {
      const { candles, replayEngine, tradingEngine } = get();
      if (candles.length === 0) return;

      replayEngine.pause();
      const lastIndex = candles.length - 1;
      const lastCandle = candles[lastIndex];

      tradingEngine.reset(get().initialBalance);

      set({
        isLiveMode: true,
        currentIndex: lastIndex,
        currentCandle: lastCandle,
        replayStatus: 'idle',
        activeTool: 'cursor',
        balance: get().initialBalance,
        equity: get().initialBalance,
        openPosition: null,
        tradeHistory: [],
        orderError: null,
      });
    },

    setPlaybackSpeed: (speed) => {
      const { replayEngine } = get();
      replayEngine.setSpeed(speed);
      set({ playbackSpeed: speed });
    },

    setActiveTool: (tool: ToolType) => {
      set({ activeTool: tool, selectedDrawingId: null });
    },

    setSelectedDrawingId: (id: string | null) => {
      set({ selectedDrawingId: id });
    },

    addDrawing: (drawing: Drawing) => {
      set((state) => ({
        drawings: [...state.drawings, drawing],
        selectedDrawingId: drawing.id,
      }));
    },

    setOrderPreview: (orderPreview) => set({ orderPreview }),

    updateDrawing: (id: string, updates: Partial<Drawing>) => {
      set((state) => ({
        drawings: state.drawings.map((d) => (d.id === id ? ({ ...d, ...updates } as Drawing) : d)),
      }));
    },

    moveDrawing: (id: string, deltaPrice: number, deltaTime: number) => {
      set((state) => ({
        drawings: state.drawings.map((d) => {
          if (d.id !== id) return d;
          if (d.type === 'trendline') {
            return {
              ...d,
              p1: { time: d.p1.time + deltaTime, price: d.p1.price + deltaPrice },
              p2: { time: d.p2.time + deltaTime, price: d.p2.price + deltaPrice },
            };
          }
          if (d.type === 'horizontal_line') {
            return {
              ...d,
              price: d.price + deltaPrice,
            };
          }
          if (d.type === 'rectangle') {
            return {
              ...d,
              p1: { time: d.p1.time + deltaTime, price: d.p1.price + deltaPrice },
              p2: { time: d.p2.time + deltaTime, price: d.p2.price + deltaPrice },
            };
          }
          if (d.type === 'circle') {
            return {
              ...d,
              center: { time: d.center.time + deltaTime, price: d.center.price + deltaPrice },
              edge: { time: d.edge.time + deltaTime, price: d.edge.price + deltaPrice },
            };
          }
          if (d.type === 'text') {
            return {
              ...d,
              point: { time: d.point.time + deltaTime, price: d.point.price + deltaPrice },
            };
          }
          if (d.type === 'long_position' || d.type === 'short_position') {
            return {
              ...d,
              entryPoint: {
                time: d.entryPoint.time + deltaTime,
                price: d.entryPoint.price + deltaPrice,
              },
              stopLossPrice: d.stopLossPrice + deltaPrice,
              takeProfitPrice: d.takeProfitPrice + deltaPrice,
              targetTime: d.targetTime !== undefined ? d.targetTime + deltaTime : undefined,
            };
          }
          return d;
        }),
      }));
    },

    reorderDrawing: (id: string, direction: 'forward' | 'backward') => {
      set((state) => {
        const list = [...state.drawings];
        const idx = list.findIndex((d) => d.id === id);
        if (idx === -1) return state;

        if (direction === 'forward' && idx < list.length - 1) {
          const temp = list[idx];
          list[idx] = list[idx + 1];
          list[idx + 1] = temp;
        } else if (direction === 'backward' && idx > 0) {
          const temp = list[idx];
          list[idx] = list[idx - 1];
          list[idx - 1] = temp;
        }
        return { drawings: list };
      });
    },

    toggleHideDrawing: (id: string) => {
      set((state) => ({
        drawings: state.drawings.map((d) => (d.id === id ? { ...d, hidden: !d.hidden } : d)),
      }));
    },

    unhideAllDrawings: () => {
      set((state) => ({
        drawings: state.drawings.map((d) => ({ ...d, hidden: false })),
      }));
    },

    removeDrawing: (id: string) => {
      set((state) => ({
        drawings: state.drawings.filter((d) => d.id !== id),
        selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
      }));
    },

    clearDrawings: () => {
      set({ drawings: [], selectedDrawingId: null });
    },

    openOrder: (params) => {
      const { tradingEngine, currentCandle } = get();
      if (!currentCandle) {
        set({ orderError: 'Cannot place order: no active market candle.' });
        return false;
      }

      const result = tradingEngine.openPosition(params, currentCandle);
      if (!result.success) {
        set({ orderError: result.error || 'Failed to open order' });
        return false;
      }

      const state = tradingEngine.getState();
      set({
        openPosition: state.openPosition,
        equity: state.equity,
        balance: state.balance,
        orderError: null,
      });
      return true;
    },

    closeCurrentPosition: () => {
      const { tradingEngine, currentCandle } = get();
      if (!currentCandle) {
        set({ orderError: 'Cannot close order: no active market candle.' });
        return false;
      }

      const result = tradingEngine.closePosition(currentCandle);
      if (!result.success) {
        set({ orderError: result.error || 'Failed to close position' });
        return false;
      }

      const state = tradingEngine.getState();
      set({
        openPosition: null,
        tradeHistory: state.tradeHistory,
        balance: state.balance,
        equity: state.equity,
        orderError: null,
      });
      return true;
    },

    resetSimulation: () => {
      get().resetReplay();
    },

    clearErrors: () => {
      set({ dataError: null, orderError: null });
    },
  };
}, {
  name: 'autick-chart-drawings',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ drawings: state.drawings }),
  skipHydration: true,
}));
