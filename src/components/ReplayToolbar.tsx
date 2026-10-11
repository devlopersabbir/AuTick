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
import { getSessionInfo } from '@/lib/utils/sessions';

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

  // Calculate active session and New York time with AM/PM
  const currentTimestamp = currentCandle ? currentCandle.timestamp : 0;
  const session = getSessionInfo(currentTimestamp);

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-b border-[#252c36] bg-[#11151b] px-5 py-3 text-neutral-200 md:flex-row md:items-center">
      {/* Primary Deck: Playback controls or Live Mode Switch */}
      <div className="flex flex-wrap items-center gap-2">
        {isLiveMode ? (
          /* Live Market Status & Bar Replay Cut Trigger */
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
              <Radio className="h-4 w-4" />
              <span>Live feed</span>
            </div>

            <button
              onClick={() => setActiveTool(activeTool === 'bar_replay' ? 'cursor' : 'bar_replay')}
              className={`flex min-h-10 items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                activeTool === 'bar_replay'
                  ? 'border-[#d6aa5b] bg-[#d6aa5b] text-[#15181c]'
                  : 'border-[#4b412e] bg-[#201d17] text-[#e3bd76] hover:border-[#d6aa5b]'
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
                className="flex min-h-10 items-center gap-2 rounded-md border border-[#4b412e] bg-[#201d17] px-4 py-2 text-sm font-semibold text-[#e3bd76] transition-colors hover:bg-[#2a251c] cursor-pointer disabled:opacity-40"
              >
                <Pause className="h-4 w-4 fill-current" />
                <span>Pause</span>
                <kbd className="hidden sm:inline-block rounded bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 text-[10px] text-amber-200">
                  Space
                </kbd>
              </button>
            ) : (
              <button
                onClick={play}
                disabled={!hasData || isEnded}
                title="Start replay [Space]"
                className="flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 cursor-pointer disabled:opacity-40"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Play</span>
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
              className="flex min-h-10 items-center gap-2 rounded-md border border-[#303844] bg-[#171c23] px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-[#202630] cursor-pointer disabled:opacity-40"
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
              className="flex min-h-10 items-center gap-2 rounded-md border border-[#303844] bg-[#171c23] px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-[#202630] cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <div className="h-5 w-px bg-[#1c2230] hidden sm:block" />

            {/* Speed Selector */}
            <div className="flex items-center gap-1 rounded-md border border-[#303844] bg-[#14181e] p-1">
              <FastForward className="h-3 w-3 text-neutral-400 ml-1 mr-0.5" />
              {speeds.map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`min-w-9 rounded px-2 py-1 text-sm font-semibold transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-[#d6aa5b] text-[#15181c]'
                      : 'text-neutral-400 hover:bg-[#242a33] hover:text-white'
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
              className="flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 cursor-pointer"
            >
              <Radio className="h-3 w-3" />
              <span>Return to Live</span>
            </button>
          </>
        )}
      </div>

      {/* Center: Scrubber Timeline Slider & Session Indicator Group */}
      <div className="flex w-full min-w-[280px] max-w-2xl flex-1 items-center gap-3 px-1 md:w-auto">
        <span className="font-mono text-sm text-neutral-400 tabular-nums">
          {currentIndex >= 0 ? `${currentIndex + 1}` : '0'}/{total}
        </span>

        {/* Scrubber Range Input */}
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={currentIndex >= 0 ? currentIndex : 0}
            onChange={handleSliderChange}
            disabled={!hasData}
            aria-label="Replay progress scrubber"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#242a33] accent-[#d6aa5b] disabled:opacity-30"
          />
        </div>

        {/* Group-wise Market Session & New York AM/PM Time Readout */}
        <div className="flex items-center space-x-2 shrink-0">
          {currentCandle ? (
            <>
              {/* Market Status & Active Session Pill */}
              {session.isMarketOpen ? (
                <span className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{session.primarySession}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span>CLOSED ({session.closeReason})</span>
                </span>
              )}

              {/* New York AM/PM Time Badge */}
              <div className="flex items-center gap-2 rounded-md border border-[#303844] bg-[#14181e] px-3 py-1.5 font-mono text-sm font-medium text-neutral-100 tabular-nums">
                <span className="text-[10px] text-amber-400 font-bold">🗽 NY</span>
                <span className="font-bold text-white tracking-wide">{session.nyTime12}</span>
                <span className="text-[10px] text-neutral-400 hidden lg:inline-block">({session.weekday})</span>
              </div>
            </>
          ) : (
            <span className="rounded-md border border-[#303844] bg-[#14181e] px-3 py-1.5 font-mono text-sm text-neutral-500 tabular-nums">
              --:-- --
            </span>
          )}
        </div>
      </div>

      {/* Right: Global Sessions Chips (Sydney, Tokyo, London, New York) */}
      <div className="flex shrink-0 items-center gap-2 text-sm">
        {session.sessions.length > 0 && (
          <div className="hidden 2xl:flex items-center gap-1 rounded-md border border-[#303844] bg-[#14181e] p-1 text-xs">
            {session.sessions.map((s) => (
              <span
                key={s.id}
                title={`${s.name} (${s.hoursNy} NY)`}
                className={`flex items-center gap-1.5 rounded px-2 py-1 font-mono font-medium transition-colors ${
                  s.isOpen
                    ? s.id === 'new_york'
                      ? 'bg-[#30291d] text-[#e3bd76]'
                      : 'bg-[#172723] text-emerald-300'
                    : 'text-neutral-500'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.shortName}</span>
                {s.isOpen && <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />}
              </span>
            ))}
          </div>
        )}

        {isEnded ? (
          <span className="flex items-center gap-2 rounded-md bg-[#30291d] px-3 py-1.5 text-sm font-medium text-[#e3bd76]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Dataset Completed</span>
          </span>
        ) : (
          <span className="rounded-md border border-[#303844] bg-[#14181e] px-3 py-1.5 font-mono text-xs text-neutral-400">
            {currentTimeframe.toUpperCase()} Candles
          </span>
        )}
      </div>
    </div>
  );
};
