import type {
  Candle,
  DatasetMetadata,
  OpenOrderParams,
  PlaybackSpeed,
  Position,
  ReplayStatus,
  Trade,
} from '@/types';
import type { Drawing, ToolType } from '@/types/drawings';
import type { ReplayEngine } from '@/lib/replay/replay-engine';
import type { TradingEngine } from '@/lib/trading/trading-engine';

export interface TradingSimulatorState {
  // Market Data
  candles: Candle[];
  metadata: DatasetMetadata | null;
  isLoadingData: boolean;
  dataError: string | null;

  // Infinite Historical Data Scrollback
  isLoadingOlderData: boolean;
  hasReachedBeginning: boolean;

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
  selectedDrawingId: string | null;
  orderPreview: {
    side: Position['side'];
    quantity: number;
    stopLoss?: number;
    takeProfit?: number;
  } | null;

  // Internal Engine instances
  replayEngine: ReplayEngine;
  tradingEngine: TradingEngine;

  // Timeframe
  currentTimeframe: string;

  // Actions
  fetchMarketData: (params: { startTime: number; endTime: number; provider?: string; timeframe?: string }) => Promise<boolean>;
  changeTimeframe: (timeframe: string) => Promise<boolean>;
  fetchOlderCandles: () => Promise<boolean>;
  setCandlesDirectly: (candles: Candle[], metadata: DatasetMetadata, isLive?: boolean) => void;
  updateLiveCandles: (newCandles: Candle[]) => void;

  // Replay & Backtest Slice Controls
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  resetReplay: () => void;
  jumpToTimestamp: (timestamp: number) => void;
  cutToBar: (timestamp: number) => void; // TradingView Bar Replay cut tool
  returnToLive: () => void; // Jump back to 100% real-time live market
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  // Drawing Actions
  setActiveTool: (tool: ToolType) => void;
  setSelectedDrawingId: (id: string | null) => void;
  addDrawing: (drawing: Drawing) => void;
  setOrderPreview: (preview: TradingSimulatorState['orderPreview']) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  moveDrawing: (id: string, deltaPrice: number, deltaTime: number) => void;
  reorderDrawing: (id: string, direction: 'forward' | 'backward') => void;
  toggleHideDrawing: (id: string) => void;
  unhideAllDrawings: () => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;

  // Trading Operations
  openOrder: (params: OpenOrderParams) => boolean;
  closeCurrentPosition: () => boolean;
  resetSimulation: () => void;
  clearErrors: () => void;
}
