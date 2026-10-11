import { describe, it, expect, beforeEach } from 'bun:test';
import { ReplayEngine } from '@/lib/replay/replay-engine';
import { Candle } from '@/types';

// Deterministic test fixture (10 consecutive 1-minute candles)
const createTestCandles = (count: number = 10, startTimestamp: number = 1700000000): Candle[] => {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: startTimestamp + i * 60,
    open: 2000 + i,
    high: 2005 + i,
    low: 1995 + i,
    close: 2002 + i,
    volume: 100,
  }));
};

describe('Historical Market Replay Engine', () => {
  let candles: Candle[];
  let engine: ReplayEngine;

  beforeEach(() => {
    candles = createTestCandles(10);
    engine = new ReplayEngine(candles);
  });

  it('initializes with paused status and authoritative index at startIndex', () => {
    expect(engine.getStatus()).toBe('paused');
    expect(engine.getCurrentIndex()).toBe(0);
    expect(engine.getCurrentCandle()).toEqual(candles[0]);
    expect(engine.getTotalCandles()).toBe(10);
  });

  it('can start at a selected candle index', () => {
    const customEngine = new ReplayEngine(candles, 4);
    expect(customEngine.getCurrentIndex()).toBe(4);
    expect(customEngine.getCurrentCandle()).toEqual(candles[4]);
  });

  it('steps forward by exactly one source candle', () => {
    expect(engine.getCurrentIndex()).toBe(0);
    const stepped = engine.stepForward();
    expect(stepped).toBe(true);
    expect(engine.getCurrentIndex()).toBe(1);
    expect(engine.getCurrentCandle()).toEqual(candles[1]);
  });

  it('prevents future-data leakage through getVisibleCandles', () => {
    // At index 0, visible candles must only be the first candle
    expect(engine.getVisibleCandles()).toHaveLength(1);
    expect(engine.getVisibleCandles()[0]).toEqual(candles[0]);

    // Step forward 2 times to index 2
    engine.stepForward();
    engine.stepForward();
    expect(engine.getCurrentIndex()).toBe(2);

    const visible = engine.getVisibleCandles();
    expect(visible).toHaveLength(3);
    expect(visible[visible.length - 1]).toEqual(candles[2]);

    // Ensure no candles after index 2 are present
    visible.forEach((c) => {
      expect(c.timestamp).toBeLessThanOrEqual(candles[2].timestamp);
    });
  });

  it('handles pause and resume', () => {
    engine.play();
    expect(engine.getStatus()).toBe('playing');
    engine.pause();
    expect(engine.getStatus()).toBe('paused');
  });

  it('changes playback speed without crashing', () => {
    engine.setSpeed(5);
    expect(engine.getSpeed()).toBe(5);
    engine.setSpeed(10);
    expect(engine.getSpeed()).toBe(10);
    engine.setSpeed(1);
    expect(engine.getSpeed()).toBe(1);
  });

  it('resets replay to the selected starting point', () => {
    engine.stepForward();
    engine.stepForward();
    expect(engine.getCurrentIndex()).toBe(2);

    engine.reset();
    expect(engine.getCurrentIndex()).toBe(0);
    expect(engine.getStatus()).toBe('paused');
    expect(engine.getCurrentCandle()).toEqual(candles[0]);
  });

  it('jumps to a selected timestamp within dataset', () => {
    const targetTimestamp = candles[5].timestamp;
    engine.jumpToTimestamp(targetTimestamp);
    expect(engine.getCurrentIndex()).toBe(5);
    expect(engine.getCurrentCandle()?.timestamp).toBe(targetTimestamp);

    // Timestamp between candle 2 and 3 should snap to candle 2
    engine.jumpToTimestamp(candles[2].timestamp + 15);
    expect(engine.getCurrentIndex()).toBe(2);
  });

  it('stops automatically and changes status to ended at the end of the dataset', () => {
    // Jump to the last candle
    engine.jumpToTimestamp(candles[9].timestamp);
    expect(engine.getCurrentIndex()).toBe(9);
    expect(engine.getStatus()).toBe('ended');

    // Further stepping should return false and remain ended
    const canStep = engine.stepForward();
    expect(canStep).toBe(false);
    expect(engine.getStatus()).toBe('ended');
  });

  it('safely handles dataset replacement while playback is running', () => {
    engine.play();
    expect(engine.getStatus()).toBe('playing');

    const newCandles = createTestCandles(5, 1800000000);
    engine.setDataset(newCandles, 1);

    expect(engine.getStatus()).toBe('paused');
    expect(engine.getTotalCandles()).toBe(5);
    expect(engine.getCurrentIndex()).toBe(1);
    expect(engine.getCurrentCandle()?.timestamp).toBe(newCandles[1].timestamp);
  });

  it('notifies listeners on each tick exactly once', () => {
    let tickCount = 0;
    let lastTickedCandle: Candle | null = null;

    engine.subscribe({
      onTick: (candle) => {
        tickCount++;
        lastTickedCandle = candle;
      },
    });

    engine.stepForward();
    expect(tickCount).toBe(1);
    expect(lastTickedCandle as Candle | null).toEqual(candles[1]);

    engine.stepForward();
    expect(tickCount).toBe(2);
    expect(lastTickedCandle as Candle | null).toEqual(candles[2]);
  });
});
