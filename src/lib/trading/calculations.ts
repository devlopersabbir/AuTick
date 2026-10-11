import { PositionSide } from '@/types';

export const DEFAULT_CONTRACT_SIZE = 1; // 1 unit = 1 troy ounce of Gold (XAUUSD)

/**
 * Calculates Gross Profit and Loss for a closed position.
 * LONG: (exit - entry) * quantity * contractSize
 * SHORT: (entry - exit) * quantity * contractSize
 */
export function calculateGrossPnl(
  side: PositionSide,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  contractSize: number = DEFAULT_CONTRACT_SIZE
): number {
  if (side === 'LONG') {
    return Number(((exitPrice - entryPrice) * quantity * contractSize).toFixed(2));
  } else {
    return Number(((entryPrice - exitPrice) * quantity * contractSize).toFixed(2));
  }
}

/**
 * Calculates Net Profit and Loss after subtracting commission or fees.
 */
export function calculateNetPnl(grossPnl: number, commission: number = 0): number {
  return Number((grossPnl - commission).toFixed(2));
}

/**
 * Calculates Unrealized Profit and Loss against current market price.
 */
export function calculateUnrealizedPnl(
  side: PositionSide,
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  contractSize: number = DEFAULT_CONTRACT_SIZE
): number {
  return calculateGrossPnl(side, entryPrice, currentPrice, quantity, contractSize);
}
