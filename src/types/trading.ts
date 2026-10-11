export type PositionSide = 'LONG' | 'SHORT';

export type ExitReason = 'SL' | 'TP' | 'MANUAL';

export interface Position {
  id: string;
  side: PositionSide;
  entryTime: number; // UTC seconds
  entryPrice: number;
  quantity: number; // Number of units (troy ounces)
  contractSize: number; // Standard multiplier (1 unit = 1 troy ounce)
  stopLoss?: number;
  takeProfit?: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface Trade {
  id: string;
  side: PositionSide;
  entryTime: number; // UTC seconds
  exitTime: number;  // UTC seconds
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  contractSize: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason: ExitReason;
  grossPnl: number;
  netPnl: number;
}

export interface OpenOrderParams {
  side: PositionSide;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradingAccountState {
  initialBalance: number;
  balance: number;
  equity: number;
  openPosition: Position | null;
  tradeHistory: Trade[];
}
