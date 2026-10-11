'use client';

import React from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  AlertCircle,
  FastForward,
  Scissors,
  Radio,
} from 'lucide-react';
import { PlaybackSpeed } from '@/types';

export const ReplayToolbar: React.FC = () => {
  const candles = useTradingSimulatorStore((s) => s.candles);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const replayStatus = useTradingSimulatorStore((s) => s.replayStatus);
  const playbackSpeed = useTradingSimulatorStore((s) => s.playbackSpeed);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);

  const play = useTradingSimulatorStore((s) => s.play);
  const pause = useTradingSimulatorStore((s) => s.pause);
  const stepForward = useTradingSimulatorStore((s) => s.stepForward);
  const resetReplay = useTradingSimulatorStore((s) => s.resetReplay);
  const jumpToTimestamp = useTradingSimulatorStore((s) => s.jumpToTimestamp);
  const returnToLive = useTradingSimulatorStore((s) => s.returnToLive);
  const setPlaybackSpeed = useTradingSimulatorStore((s) => s.setPlaybackSpeed);

  const total = candles.length;
  const isPlaying = replayStatus === 'playing';
  const isEnded = replayStatus === 'ended';
  const hasData = total > 0;

  const speeds: PlaybackSpeed[] = [1, 2, 5, 10];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetIdx = parseInt(e.target.value, 10);
    if (candles[targetIdx]) {
      jumpToTimestamp(candles[targetIdx].timestamp);
    }
  };

  const formatUtcTime = (timestamp?: number) => {
    if (!timestamp) return '--:--:--';
    const d = new Date(timestamp * 1000);
    return d.toISOString().replace('T', ' ').substring(11, 19);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b border-[#1c2230] bg-[#0d1017]/95 px-4 py-2 text-neutral-200">
      {/* Primary Deck */}
      <div className="flex items-center space-x-2.5">
        {isLiveMode ? (
          /* Live Market Status & Bar Replay Cut Trigger */
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-400 font-bold text-xs">
              <Radio className="h-3.5 w-3.5 animate-spin" />
              <span>LIVE FEED ACTIVE</span>
            </div>

            <button
              onClick={() => setActiveTool(activeTool === 'bar_replay' ? 'cursor' : 'bar_replay')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md ${
                activeTool === 'bar_replay'
                  ? 'bg-amber-500 text-black shadow-amber-500/30 font-extrabold animate-pulse'
                  : 'bg-[#161d2d] hover:bg-[#1e273d] text-amber-300 border border-amber-500/40 hover:border-amber-500/70'
              }`}
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>{activeTool === 'bar_replay' ? 'Cancel Cut' : 'Cut Bar to Backtest'}</span>
              <kbd className="hidden sm:inline-block rounded bg-black/30 px-1 py-0.2 text-[10px] font-mono">
                C
              </kbd>
            </button>
          </div>
        ) : (
          /* Backtest Replay Playback Controls */
          <>
            {/* Play/Pause Button */}
            {isPlaying ? (
              <button
                onClick={pause}
                disabled={!hasData}
                title="Pause replay [Space]"
                className="flex items-center space-x-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-4 py-1.5 text-xs font-bold transition-all shadow-md shadow-amber-950/40 cursor-pointer disabled:opacity-40"
              >
                <Pause className="h-4 w-4 fill-current animate-pulse" />
                <span>PAUSE</span>
                <kbd className="hidden sm:inline-block rounded bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 text-[10px] text-amber-200">
                  Space
                </kbd>
              </button>
            ) : (
              <button
                onClick={play}
                disabled={!hasData || isEnded}
                title="Start replay [Space]"
                className="flex items-center space-x-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-xs font-bold transition-all shadow-md shadow-emerald-950/60 cursor-pointer disabled:opacity-40"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>PLAY</span>
                <kbd className="hidden sm:inline-block rounded bg-emerald-700/60 px-1 py-0.2 text-[10px] text-emerald-100">
                  Space
                </kbd>
              </button>
            )}

            {/* Step Forward Button */}
            <button
              onClick={stepForward}
              disabled={!hasData || isEnded}
              title="Step forward 1 candle [→]"
              className="flex items-center space-x-1.5 rounded-lg bg-[#141926] hover:bg-[#1a2133] text-neutral-200 border border-[#232b3d] hover:border-[#333e56] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              <StepForward className="h-3.5 w-3.5" />
              <span>Step</span>
              <kbd className="hidden sm:inline-block rounded bg-[#0b0e14] border border-[#2a344a] px-1 py-0.2 text-[10px] text-neutral-400">
                →
              </kbd>
            </button>

            {/* Reset Button */}
            <button
              onClick={resetReplay}
              disabled={!hasData}
              title="Reset to beginning of slice [R]"
              className="flex items-center space-x-1.5 rounded-lg bg-[#141926] hover:bg-[#1a2133] text-neutral-300 border border-[#232b3d] hover:border-[#333e56] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <div className="h-5 w-px bg-[#1c2230] hidden sm:block" />

            {/* Speed Selector */}
            <div className="flex items-center space-x-1 rounded-lg border border-[#1e2638] bg-[#10141f] p-1">
              <FastForward className="h-3 w-3 text-neutral-400 ml-1 mr-0.5" />
              {speeds.map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`rounded px-2 py-0.5 text-xs font-bold transition-all cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                      : 'text-neutral-400 hover:text-white hover:bg-[#161c2b]'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>

            {/* Jump to Live Button */}
            <button
              onClick={returnToLive}
              title="Exit backtest mode and return to real-time live market"
              className="flex items-center space-x-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-950/50"
            >
              <Radio className="h-3 w-3" />
              <span>Return to Live</span>
            </button>
          </>
        )}
      </div>

      {/* Scrubber Timeline Slider (Always accessible to navigate historical candles) */}
      <div className="flex flex-1 items-center space-x-3 w-full md:w-auto px-2 min-w-[240px] max-w-xl">
        <span className="font-mono text-xs text-neutral-400 tabular-nums">
          {currentIndex >= 0 ? `${currentIndex + 1}` : '0'}/{total}
        </span>

        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={currentIndex >= 0 ? currentIndex : 0}
            onChange={handleSliderChange}
            disabled={!hasData}
            aria-label="Replay progress scrubber"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#141926] border border-[#232b3d] accent-amber-500 disabled:opacity-30"
          />
        </div>

        <span className="font-mono text-xs font-semibold text-neutral-200 tabular-nums bg-[#10141f] border border-[#1e2638] px-2 py-0.5 rounded">
          {currentCandle ? formatUtcTime(currentCandle.timestamp) : '--:--:--'}
        </span>
      </div>

      {/* Right status badge */}
      <div className="flex items-center space-x-2 text-xs">
        {isEnded ? (
          <span className="flex items-center space-x-1 rounded-lg bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 text-xs font-semibold text-amber-400 animate-pulse">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Dataset Completed</span>
          </span>
        ) : (
          <span className="rounded bg-[#10141f] border border-[#1e2638] px-2 py-1 text-[11px] font-mono text-neutral-400">
            {currentTimeframe.toUpperCase()} Candles ({isLiveMode ? 'Real-Time' : 'Historical Slice'})
          </span>
        )}
      </div>
    </div>
  );
};
