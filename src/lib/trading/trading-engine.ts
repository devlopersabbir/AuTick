import { Candle, OpenOrderParams, Position, Trade, TradingAccountState } from '@/types';
import { calculateGrossPnl, calculateNetPnl, calculateUnrealizedPnl, DEFAULT_CONTRACT_SIZE } from './calculations';

export class TradingEngine {
  private initialBalance: number;
  private balance: number;
  private equity: number;
  private currentPosition: Position | null = null;
  private tradeHistory: Trade[] = [];
  private lastProcessedCandleTimestamp: number | null = null;

  constructor(initialBalance: number = 1000) {
    this.initialBalance = initialBalance;
    this.balance = initialBalance;
    this.equity = initialBalance;
  }

  public getState(): TradingAccountState {
    return {
      initialBalance: this.initialBalance,
      balance: this.balance,
      equity: this.equity,
      openPosition: this.currentPosition ? { ...this.currentPosition } : null,
      tradeHistory: [...this.tradeHistory],
    };
  }

  public getOpenPosition(): Position | null {
    return this.currentPosition ? { ...this.currentPosition } : null;
  }

  public getTradeHistory(): Trade[] {
    return [...this.tradeHistory];
  }

  public getBalance(): number {
    return this.balance;
  }

  public getEquity(): number {
    return this.equity;
  }

  /**
   * Opens a new market position at the current candle's close price.
   */
  public openPosition(params: OpenOrderParams, currentCandle: Candle): { success: boolean; error?: string; position?: Position } {
    if (this.currentPosition !== null) {
      return { success: false, error: 'Cannot open position: an open position already exists. Close it first.' };
    }

    if (!params.quantity || params.quantity <= 0 || !Number.isFinite(params.quantity)) {
      return { success: false, error: 'Invalid order quantity: must be greater than 0.' };
    }

    const entryPrice = currentCandle.close;

    // Validate Stop Loss and Take Profit levels
    if (params.side === 'LONG') {
      if (params.stopLoss !== undefined && params.stopLoss >= entryPrice) {
        return { success: false, error: `Invalid Stop Loss for LONG: ${params.stopLoss} must be below entry price ${entryPrice}.` };
      }
      if (params.takeProfit !== undefined && params.takeProfit <= entryPrice) {
        return { success: false, error: `Invalid Take Profit for LONG: ${params.takeProfit} must be above entry price ${entryPrice}.` };
      }
    } else {
      // SHORT
      if (params.stopLoss !== undefined && params.stopLoss <= entryPrice) {
        return { success: false, error: `Invalid Stop Loss for SHORT: ${params.stopLoss} must be above entry price ${entryPrice}.` };
      }
      if (params.takeProfit !== undefined && params.takeProfit >= entryPrice) {
        return { success: false, error: `Invalid Take Profit for SHORT: ${params.takeProfit} must be below entry price ${entryPrice}.` };
      }
    }

    const id = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPosition: Position = {
      id,
      side: params.side,
      entryTime: currentCandle.timestamp,
      entryPrice,
      quantity: params.quantity,
      contractSize: DEFAULT_CONTRACT_SIZE,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
    };

    this.currentPosition = newPosition;
    this.lastProcessedCandleTimestamp = currentCandle.timestamp;
    this.equity = this.balance;

    return { success: true, position: { ...newPosition } };
  }

  /**
   * Evaluates the open position against a new candle.
   * SL / TP checks are performed on subsequent historical candles.
   * Execution model:
   * - LONG:
   *   - If low <= SL: triggers SL
   *   - If high >= TP: triggers TP
   *   - If both touched in same candle: conservative assumption -> Stop Loss triggered first.
   * - SHORT:
   *   - If high >= SL: triggers SL
   *   - If low <= TP: triggers TP
   *   - If both touched in same candle: conservative assumption -> Stop Loss triggered first.
   */
  public processCandle(candle: Candle): { closedTrade?: Trade } {
    if (!this.currentPosition) {
      return {};
    }

    // Do not evaluate SL/TP on the exact candle where entry occurred
    if (candle.timestamp <= this.currentPosition.entryTime) {
      return {};
    }

    // Prevent duplicate evaluation of the exact same candle
    if (this.lastProcessedCandleTimestamp !== null && candle.timestamp <= this.lastProcessedCandleTimestamp) {
      return {};
    }
    this.lastProcessedCandleTimestamp = candle.timestamp;

    const pos = this.currentPosition;
    let exitTriggered = false;
    let exitPrice = 0;
    let exitReason: 'SL' | 'TP' = 'SL';

    if (pos.side === 'LONG') {
      const slHit = pos.stopLoss !== undefined && candle.low <= pos.stopLoss;
      const tpHit = pos.takeProfit !== undefined && candle.high >= pos.takeProfit;

      if (slHit && tpHit) {
        // Both hit: Conservative assumption -> SL takes priority
        exitTriggered = true;
        exitPrice = pos.stopLoss!;
        exitReason = 'SL';
      } else if (slHit) {
        exitTriggered = true;
        exitPrice = pos.stopLoss!;
        exitReason = 'SL';
      } else if (tpHit) {
        exitTriggered = true;
        exitPrice = pos.takeProfit!;
        exitReason = 'TP';
      }
    } else {
      // SHORT
      const slHit = pos.stopLoss !== undefined && candle.high >= pos.stopLoss;
      const tpHit = pos.takeProfit !== undefined && candle.low <= pos.takeProfit;

      if (slHit && tpHit) {
        // Both hit: Conservative assumption -> SL takes priority
        exitTriggered = true;
        exitPrice = pos.stopLoss!;
        exitReason = 'SL';
      } else if (slHit) {
        exitTriggered = true;
        exitPrice = pos.stopLoss!;
        exitReason = 'SL';
      } else if (tpHit) {
        exitTriggered = true;
        exitPrice = pos.takeProfit!;
        exitReason = 'TP';
      }
    }

    if (exitTriggered) {
      const grossPnl = calculateGrossPnl(pos.side, pos.entryPrice, exitPrice, pos.quantity, pos.contractSize);
      const netPnl = calculateNetPnl(grossPnl, 0);

      const trade: Trade = {
        id: pos.id,
        side: pos.side,
        entryTime: pos.entryTime,
        exitTime: candle.timestamp,
        entryPrice: pos.entryPrice,
        exitPrice,
        quantity: pos.quantity,
        contractSize: pos.contractSize,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        exitReason,
        grossPnl,
        netPnl,
      };

      this.balance = Number((this.balance + netPnl).toFixed(2));
      this.equity = this.balance;
      this.tradeHistory.push(trade);
      this.currentPosition = null;

      return { closedTrade: trade };
    }

    // Position remains open: update unrealized P&L
    pos.currentPrice = candle.close;
    pos.unrealizedPnl = calculateUnrealizedPnl(pos.side, pos.entryPrice, candle.close, pos.quantity, pos.contractSize);
    this.equity = Number((this.balance + pos.unrealizedPnl).toFixed(2));

    return {};
  }

  /**
   * Manually closes the open position at the current candle's close price.
   */
  public closePosition(currentCandle: Candle): { success: boolean; error?: string; trade?: Trade } {
    if (!this.currentPosition) {
      return { success: false, error: 'No open position to close.' };
    }

    const pos = this.currentPosition;
    const exitPrice = currentCandle.close;
    const grossPnl = calculateGrossPnl(pos.side, pos.entryPrice, exitPrice, pos.quantity, pos.contractSize);
    const netPnl = calculateNetPnl(grossPnl, 0);

    const trade: Trade = {
      id: pos.id,
      side: pos.side,
      entryTime: pos.entryTime,
      exitTime: currentCandle.timestamp,
      entryPrice: pos.entryPrice,
      exitPrice,
      quantity: pos.quantity,
      contractSize: pos.contractSize,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      exitReason: 'MANUAL',
      grossPnl,
      netPnl,
    };

    this.balance = Number((this.balance + netPnl).toFixed(2));
    this.equity = this.balance;
    this.tradeHistory.push(trade);
    this.currentPosition = null;

    return { success: true, trade };
  }

  public reset(initialBalance: number = this.initialBalance): void {
    this.initialBalance = initialBalance;
    this.balance = initialBalance;
    this.equity = initialBalance;
    this.currentPosition = null;
    this.tradeHistory = [];
    this.lastProcessedCandleTimestamp = null;
  }
}
