import { create } from 'zustand';
import {
  Candle,
  DatasetMetadata,
  OpenOrderParams,
  PlaybackSpeed,
  Position,
  ReplayStatus,
  Trade,
} from '@/types';
import { ToolType, Drawing } from '@/types/drawings';
import { ReplayEngine } from '@/lib/replay/replay-engine';
import { TradingEngine } from '@/lib/trading/trading-engine';
import { MarketDataApiResponse } from '@/lib/market-data/types';

interface TradingSimulatorState {
  // Market Data
  candles: Candle[];
  metadata: DatasetMetadata | null;
  isLoadingData: boolean;
  dataError: string | null;

  // Live vs Backtest Replay Mode
  isLiveMode: boolean; // TRUE: Tracking real-time live market; FALSE: Sliced backtest replay mode

  // Replay
  currentIndex: number;
  currentCandle: Candle | null;
  replayStatus: ReplayStatus;
  playbackSpeed: PlaybackSpeed;

  // Trading
  initialBalance: number;
  balance: number;
  equity: number;
  openPosition: Position | null;
  tradeHistory: Trade[];
  orderError: string | null;

  // TradingView Left Toolbar & Drawings
  activeTool: ToolType;
  drawings: Drawing[];

  // Internal Engine instances
  replayEngine: ReplayEngine;
  tradingEngine: TradingEngine;

  // Timeframe
  currentTimeframe: string;

  // Actions
  fetchMarketData: (params: { startTime: number; endTime: number; provider?: string; timeframe?: string }) => Promise<boolean>;
  changeTimeframe: (timeframe: string) => Promise<boolean>;
  setCandlesDirectly: (candles: Candle[], metadata: DatasetMetadata, isLive?: boolean) => void;
  updateLiveCandles: (newCandles: Candle[]) => void;
  
  // Replay & Backtest Slice Controls
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  resetReplay: () => void;
  jumpToTimestamp: (timestamp: number) => void;
  cutToBar: (timestamp: number) => void; // TradingView Bar Replay cut tool
  returnToLive: () => void;              // Jump back to 100% real-time live market
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  // Drawing Actions
  setActiveTool: (tool: ToolType) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;

  // Trading Operations
  openOrder: (params: OpenOrderParams) => boolean;
  closeCurrentPosition: () => boolean;
  resetSimulation: () => void;
  clearErrors: () => void;
}

const initialReplayEngine = new ReplayEngine([]);
const initialTradingEngine = new TradingEngine(1000);

export const useTradingSimulatorStore = create<TradingSimulatorState>((set, get) => {
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

    replayEngine: initialReplayEngine,
    tradingEngine: initialTradingEngine,

    currentTimeframe: '1m',

    fetchMarketData: async ({ startTime, endTime, provider, timeframe }) => {
      const activeTf = timeframe || get().currentTimeframe || '1m';
      set({ isLoadingData: true, dataError: null, currentTimeframe: activeTf });

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

        // Live market is active by default
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

    setCandlesDirectly: (candles, metadata, isLive = true) => {
      const { replayEngine, tradingEngine } = get();

      // Clean up previous listeners and setup fresh engine state
      replayEngine.cleanup();
      
      // When live, position at latest candle; when historical replay, start at beginning or current index
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
          // Intrabar tick update
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
          // New bar has formed
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
      if (isLiveMode) {
        // If user hits play in live mode, stay paused or let them know to cut
        return;
      }
      if (currentIndex >= candles.length - 1) {
        // Reached end of slice
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

      // Find closest candle <= timestamp
      let targetIndex = 0;
      for (let i = 0; i < candles.length; i++) {
        if (candles[i].timestamp <= timestamp) {
          targetIndex = i;
        } else {
          break;
        }
      }

      // Configure replay engine to play from this cut candle
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
      set({ activeTool: tool });
    },

    addDrawing: (drawing: Drawing) => {
      set((state) => ({ drawings: [...state.drawings, drawing] }));
    },

    updateDrawing: (id: string, updates: Partial<Drawing>) => {
      set((state) => ({
        drawings: state.drawings.map((d) => (d.id === id ? ({ ...d, ...updates } as Drawing) : d)),
      }));
    },

    removeDrawing: (id: string) => {
      set((state) => ({
        drawings: state.drawings.filter((d) => d.id !== id),
      }));
    },

    clearDrawings: () => {
      set({ drawings: [] });
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
});
