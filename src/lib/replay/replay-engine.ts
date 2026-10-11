import { Candle, PlaybackSpeed, ReplayStatus } from '@/types';

export interface ReplayEngineListener {
  onTick?: (candle: Candle, index: number) => void;
  onStatusChange?: (status: ReplayStatus) => void;
}

export class ReplayEngine {
  private candles: Candle[] = [];
  private currentIndex: number = -1;
  private status: ReplayStatus = 'idle';
  private speed: PlaybackSpeed = 1;
  private startFromIndex: number = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isProcessingTick: boolean = false;
  private listeners: Set<ReplayEngineListener> = new Set();

  constructor(candles: Candle[] = [], startIndex: number = 0) {
    if (candles.length > 0) {
      this.setDataset(candles, startIndex);
    }
  }

  public subscribe(listener: ReplayEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyTick(candle: Candle, index: number): void {
    this.listeners.forEach((l) => l.onTick?.(candle, index));
  }

  private notifyStatusChange(status: ReplayStatus): void {
    this.listeners.forEach((l) => l.onStatusChange?.(status));
  }

  public setDataset(candles: Candle[], startIndex: number = 0): void {
    this.pause();
    this.candles = [...candles];
    this.startFromIndex = Math.max(0, Math.min(startIndex, this.candles.length - 1));
    this.currentIndex = this.startFromIndex;
    this.status = this.candles.length > 0 ? 'paused' : 'idle';
    this.notifyStatusChange(this.status);

    if (this.currentIndex >= 0 && this.currentIndex < this.candles.length) {
      this.notifyTick(this.candles[this.currentIndex], this.currentIndex);
    }
  }

  public play(): void {
    if (this.candles.length === 0) return;
    if (this.status === 'playing') return;

    // If at the end, do not play unless reset
    if (this.currentIndex >= this.candles.length - 1) {
      this.status = 'ended';
      this.notifyStatusChange(this.status);
      return;
    }

    this.status = 'playing';
    this.notifyStatusChange(this.status);
    this.scheduleNextTick();
  }

  public pause(): void {
    this.clearTimer();
    if (this.status === 'playing') {
      this.status = 'paused';
      this.notifyStatusChange(this.status);
    }
  }

  public stepForward(): boolean {
    if (this.candles.length === 0) return false;
    this.pause();

    if (this.currentIndex >= this.candles.length - 1) {
      this.status = 'ended';
      this.notifyStatusChange(this.status);
      return false;
    }

    this.currentIndex++;
    const candle = this.candles[this.currentIndex];
    this.notifyTick(candle, this.currentIndex);

    if (this.currentIndex >= this.candles.length - 1) {
      this.status = 'ended';
      this.notifyStatusChange(this.status);
    }

    return true;
  }

  public reset(): void {
    this.pause();
    if (this.candles.length === 0) {
      this.currentIndex = -1;
      this.status = 'idle';
      this.notifyStatusChange(this.status);
      return;
    }

    this.currentIndex = this.startFromIndex;
    this.status = 'paused';
    this.notifyStatusChange(this.status);
    this.notifyTick(this.candles[this.currentIndex], this.currentIndex);
  }

  public jumpToTimestamp(timestamp: number): void {
    if (this.candles.length === 0) return;
    this.pause();

    // Binary search or linear search for closest candle <= timestamp
    let targetIndex = -1;
    for (let i = 0; i < this.candles.length; i++) {
      if (this.candles[i].timestamp <= timestamp) {
        targetIndex = i;
      } else {
        break;
      }
    }

    if (targetIndex === -1) {
      targetIndex = 0;
    }

    this.currentIndex = targetIndex;
    this.status = this.currentIndex >= this.candles.length - 1 ? 'ended' : 'paused';
    this.notifyStatusChange(this.status);
    this.notifyTick(this.candles[this.currentIndex], this.currentIndex);
  }

  public setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    if (this.status === 'playing') {
      this.clearTimer();
      this.scheduleNextTick();
    }
  }

  public getSpeed(): PlaybackSpeed {
    return this.speed;
  }

  public getStatus(): ReplayStatus {
    return this.status;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getTotalCandles(): number {
    return this.candles.length;
  }

  public getCurrentCandle(): Candle | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.candles.length) {
      return this.candles[this.currentIndex];
    }
    return null;
  }

  /**
   * Returns only candles up to the current authoritative index.
   * STRICT GUARANTEE: Never exposes future candles.
   */
  public getVisibleCandles(): Candle[] {
    if (this.currentIndex < 0 || this.candles.length === 0) {
      return [];
    }
    return this.candles.slice(0, this.currentIndex + 1);
  }

  public cleanup(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private getTickIntervalMs(): number {
    // 1x = 1000ms, 2x = 500ms, 5x = 200ms, 10x = 100ms
    return Math.round(1000 / this.speed);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNextTick(): void {
    this.clearTimer();
    if (this.status !== 'playing') return;

    this.timerId = setTimeout(() => {
      this.executeTick();
    }, this.getTickIntervalMs());
  }

  private executeTick(): void {
    if (this.status !== 'playing' || this.isProcessingTick) return;

    this.isProcessingTick = true;

    try {
      if (this.currentIndex >= this.candles.length - 1) {
        this.status = 'ended';
        this.notifyStatusChange(this.status);
        this.clearTimer();
        return;
      }

      this.currentIndex++;
      const currentCandle = this.candles[this.currentIndex];
      this.notifyTick(currentCandle, this.currentIndex);

      if (this.currentIndex >= this.candles.length - 1) {
        this.status = 'ended';
        this.notifyStatusChange(this.status);
        this.clearTimer();
        return;
      }
    } finally {
      this.isProcessingTick = false;
    }

    // Schedule next tick if still playing
    if (this.status === 'playing') {
      this.scheduleNextTick();
    }
  }
}
