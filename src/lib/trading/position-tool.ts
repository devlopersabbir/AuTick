import type { DataPoint, PositionToolDrawing } from '@/types/drawings';

export const POSITION_TOOL_DEFAULT_RISK = 10;
export const POSITION_TOOL_DEFAULT_REWARD_RISK = 2;
export const POSITION_TOOL_DEFAULT_WIDTH_BARS = 25;
export const POSITION_TOOL_MIN_PRICE_DISTANCE = 0.01;
export const POSITION_TOOL_MIN_WIDTH_BARS = 1;

export function getDefaultPositionLevels(
  side: 'long_position' | 'short_position',
  entryPrice: number,
  riskDistance = POSITION_TOOL_DEFAULT_RISK,
  rewardRisk = POSITION_TOOL_DEFAULT_REWARD_RISK,
) {
  const direction = side === 'long_position' ? 1 : -1;
  const risk = Math.abs(riskDistance);
  const reward = risk * rewardRisk;

  return {
    stopLossPrice: entryPrice - direction * risk,
    takeProfitPrice: entryPrice + direction * reward,
  };
}

export function movePositionTool(
  drawing: PositionToolDrawing,
  nextEntryPoint: DataPoint,
): Pick<PositionToolDrawing, 'entryPoint' | 'stopLossPrice' | 'takeProfitPrice' | 'targetTime'> {
  const priceDelta = nextEntryPoint.price - drawing.entryPoint.price;
  const timeDelta = nextEntryPoint.time - drawing.entryPoint.time;

  return {
    entryPoint: nextEntryPoint,
    stopLossPrice: drawing.stopLossPrice + priceDelta,
    takeProfitPrice: drawing.takeProfitPrice + priceDelta,
    targetTime: drawing.targetTime === undefined
      ? undefined
      : drawing.targetTime + timeDelta,
  };
}

export function resizePositionToolLevel(
  drawing: PositionToolDrawing,
  level: 'stopLossPrice' | 'takeProfitPrice',
  price: number,
): Pick<PositionToolDrawing, 'stopLossPrice' | 'takeProfitPrice'> {
  const isLong = drawing.type === 'long_position';
  const minDistance = POSITION_TOOL_MIN_PRICE_DISTANCE;
  const isStopLoss = level === 'stopLossPrice';
  const shouldBeBelowEntry = isLong === isStopLoss;
  const constrainedPrice = shouldBeBelowEntry
    ? Math.min(price, drawing.entryPoint.price - minDistance)
    : Math.max(price, drawing.entryPoint.price + minDistance);

  return {
    stopLossPrice: level === 'stopLossPrice' ? constrainedPrice : drawing.stopLossPrice,
    takeProfitPrice: level === 'takeProfitPrice' ? constrainedPrice : drawing.takeProfitPrice,
  };
}

export function resizePositionToolWidth(
  drawing: PositionToolDrawing,
  targetTime: number,
  timeframeSeconds: number,
): number {
  return Math.max(
    targetTime,
    drawing.entryPoint.time + timeframeSeconds * POSITION_TOOL_MIN_WIDTH_BARS,
  );
}

export function getPositionToolTargetTime(entryTime: number, timeframeSeconds: number): number {
  return entryTime + timeframeSeconds * POSITION_TOOL_DEFAULT_WIDTH_BARS;
}

export function formatPositionToolRiskReward(risk: number, reward: number): string {
  if (risk <= 0 || reward < 0) return '1:0.00';
  return `1:${(reward / risk).toFixed(2)}`;
}
