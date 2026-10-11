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
import { ReplayEngine } from '@/lib/replay/replay-engine';
import { TradingEngine } from '@/lib/trading/trading-engine';
import { MarketDataApiResponse } from '@/lib/market-data/types';

interface TradingSimulatorState {
  // Market Data
  candles: Candle[];
  metadata: DatasetMetadata | null;
  isLoadingData: boolean;
  dataError: string | null;

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

  // Internal Engine instances
  replayEngine: ReplayEngine;
  tradingEngine: TradingEngine;

  // Timeframe
  currentTimeframe: string;

  // Actions
  fetchMarketData: (params: { startTime: number; endTime: number; provider?: string; timeframe?: string }) => Promise<boolean>;
  changeTimeframe: (timeframe: string) => Promise<boolean>;
  setCandlesDirectly: (candles: Candle[], metadata: DatasetMetadata) => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  resetReplay: () => void;
  jumpToTimestamp: (timestamp: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

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

        get().setCandlesDirectly(json.candles, json.metadata!);
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

    setCandlesDirectly: (candles, metadata) => {
      const { replayEngine, tradingEngine } = get();

      // Clean up previous listeners and setup fresh engine state
      replayEngine.cleanup();
      const newReplayEngine = new ReplayEngine(candles, 0);

      newReplayEngine.subscribe({
        onTick: syncFromTick,
        onStatusChange: syncStatusChange,
      });

      tradingEngine.reset(get().initialBalance);

      const firstCandle = candles[0] || null;

      set({
        candles,
        metadata,
        replayEngine: newReplayEngine,
        tradingEngine,
        currentIndex: candles.length > 0 ? 0 : -1,
        currentCandle: firstCandle,
        replayStatus: candles.length > 0 ? 'paused' : 'idle',
        balance: get().initialBalance,
        equity: get().initialBalance,
        openPosition: null,
        tradeHistory: [],
        orderError: null,
      });
    },

    play: () => {
      const { replayEngine } = get();
      replayEngine.play();
      set({ replayStatus: replayEngine.getStatus() });
    },

    pause: () => {
      const { replayEngine } = get();
      replayEngine.pause();
      set({ replayStatus: replayEngine.getStatus() });
    },

    stepForward: () => {
      const { replayEngine } = get();
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
      set({ replayStatus: replayEngine.getStatus() });
    },

    setPlaybackSpeed: (speed) => {
      const { replayEngine } = get();
      replayEngine.setSpeed(speed);
      set({ playbackSpeed: speed });
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
