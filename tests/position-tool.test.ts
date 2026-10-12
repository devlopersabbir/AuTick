import { describe, expect, it } from 'bun:test';
import type { PositionToolDrawing } from '@/types/drawings';
import {
  formatPositionToolRiskReward,
  getDefaultPositionLevels,
  getPositionToolTargetTime,
  resizePositionToolLevel,
  resizePositionToolWidth,
  movePositionTool,
} from '@/lib/trading/position-tool';

describe('Chart long/short position tool', () => {
  it('starts long and short positions with a 1:2 reward-to-risk ratio', () => {
    const long = getDefaultPositionLevels('long_position', 4000);
    const short = getDefaultPositionLevels('short_position', 4000);

    expect(long).toEqual({ stopLossPrice: 3990, takeProfitPrice: 4020 });
    expect(short).toEqual({ stopLossPrice: 4010, takeProfitPrice: 3980 });
    expect(formatPositionToolRiskReward(10, 20)).toBe('1:2.00');
  });

  it('moves the entry and keeps both price distances and box width intact', () => {
    const drawing: PositionToolDrawing = {
      id: 'short',
      type: 'short_position',
      entryPoint: { time: 600, price: 4000 },
      stopLossPrice: 4010,
      takeProfitPrice: 3980,
      quantity: 1,
      targetTime: 2100,
    };

    expect(movePositionTool(drawing, { time: 900, price: 4050 })).toEqual({
      entryPoint: { time: 900, price: 4050 },
      stopLossPrice: 4060,
      takeProfitPrice: 4030,
      targetTime: 2400,
    });
  });

  it('keeps stop-loss and take-profit on the correct side of entry when resizing', () => {
    const long: PositionToolDrawing = {
      id: 'long',
      type: 'long_position',
      entryPoint: { time: 600, price: 4000 },
      stopLossPrice: 3990,
      takeProfitPrice: 4020,
      quantity: 1,
    };
    const short: PositionToolDrawing = { ...long, id: 'short', type: 'short_position' };

    expect(resizePositionToolLevel(long, 'stopLossPrice', 4100).stopLossPrice).toBe(3999.99);
    expect(resizePositionToolLevel(long, 'takeProfitPrice', 3900).takeProfitPrice).toBe(4000.01);
    expect(resizePositionToolLevel(short, 'stopLossPrice', 3900).stopLossPrice).toBe(4000.01);
    expect(resizePositionToolLevel(short, 'takeProfitPrice', 4100).takeProfitPrice).toBe(3999.99);
  });

  it('sizes the default box by the active candle interval and never collapses its width', () => {
    const drawing: PositionToolDrawing = {
      id: 'long',
      type: 'long_position',
      entryPoint: { time: 600, price: 4000 },
      stopLossPrice: 3990,
      takeProfitPrice: 4020,
      quantity: 1,
      targetTime: 8100,
    };

    expect(getPositionToolTargetTime(600, 300)).toBe(8100);
    expect(resizePositionToolWidth(drawing, 900, 300)).toBe(900);
    expect(resizePositionToolWidth(drawing, 900, 60)).toBe(900);
  });
});
