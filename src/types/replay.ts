export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'ended';

export type PlaybackSpeed = 1 | 2 | 5 | 10;

export interface ReplayEngineState {
  currentIndex: number;
  status: ReplayStatus;
  speed: PlaybackSpeed;
  startFromIndex: number;
}
