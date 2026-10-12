'use client';

import { Activity, Clock3, Loader2, Play, Radio, Scissors, Zap } from 'lucide-react';
import { Candle } from '@/types';
import { ToolType } from '@/types/drawings';
import { getSessionInfo } from '@/lib/utils/sessions';

interface ChartHudProps {
  timeframe: string;
  isLiveMode: boolean;
  onReturnToLive: () => void;
  isLoadingOlderData: boolean;
  hasReachedBeginning: boolean;
  activeCandle: Candle | null;
  priceChange: number;
  priceChangePercent: number;
  isUp: boolean;
  sessionCountdown: string | null;
  sessionAction: 'opens' | 'closes' | null;
  activeTool: ToolType;
  activeToolInstruction: string;
  onCancelTool: () => void;
}

export function ChartHud({
  timeframe,
  isLiveMode,
  onReturnToLive,
  isLoadingOlderData,
  hasReachedBeginning,
  activeCandle,
  priceChange,
  priceChangePercent,
  isUp,
  sessionCountdown,
  sessionAction,
  activeTool,
  activeToolInstruction,
  onCancelTool,
}: ChartHudProps) {
  const session = activeCandle ? getSessionInfo(activeCandle.timestamp) : null;

  return (
    <>
      <div className="absolute top-3 left-4 z-20 flex flex-wrap items-center gap-2.5 bg-[#0d111a]/90 backdrop-blur-md border border-[#1e273a] px-3.5 py-1.5 rounded-lg text-xs shadow-lg">
        <div className="flex items-center space-x-1.5 font-bold">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-white tracking-wide">XAUUSD</span>
          <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Bybit candles</span>
          <span className="text-[10px] bg-[#161d2d] text-amber-400 border border-amber-500/30 px-1 rounded font-mono">
            {timeframe.toUpperCase()}
          </span>
        </div>

        {isLiveMode ? (
          <div className="flex items-center space-x-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase animate-pulse">
            <Radio className="h-3 w-3 animate-spin" />
            <span>LIVE</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="bg-amber-500/15 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
              REPLAY BACKTEST
            </span>
            <button
              type="button"
              onClick={onReturnToLive}
              title="Return to real-time live market"
              className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm shadow-emerald-900/50"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
              <span>Jump to Live</span>
            </button>
          </div>
        )}

        {isLoadingOlderData && (
          <div className="flex items-center space-x-1.5 bg-[#161d2d] text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-medium animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading older candles...</span>
          </div>
        )}

        {hasReachedBeginning && (
          <span className="text-[10px] text-neutral-500 italic">Beginning of historical feed reached</span>
        )}

        <div className="h-4 w-px bg-[#1e273a]" />

        {activeCandle ? (
          <div className="flex items-center space-x-2.5 font-mono text-[11px] tabular-nums">
            <div><span className="text-neutral-500 mr-1">O:</span><span className="text-neutral-200 font-semibold">{activeCandle.open.toFixed(2)}</span></div>
            <div><span className="text-neutral-500 mr-1">H:</span><span className="text-neutral-200 font-semibold">{activeCandle.high.toFixed(2)}</span></div>
            <div><span className="text-neutral-500 mr-1">L:</span><span className="text-neutral-200 font-semibold">{activeCandle.low.toFixed(2)}</span></div>
            <div>
              <span className="text-neutral-500 mr-1">C:</span>
              <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{activeCandle.close.toFixed(2)}</span>
            </div>
            <div className={`font-semibold px-1 rounded ${isUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </div>
          </div>
        ) : (
          <span className="text-neutral-500 italic text-[11px]">Connecting to XAUUSD feed...</span>
        )}

        {session && (
          <>
            <div className="h-4 w-px bg-[#1e273a]" />
            {session.isMarketOpen ? (
              <div className="flex items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>🗽 NY {session.nyTime12}</span>
                <span className="text-neutral-400">•</span>
                <span className="text-emerald-400">{session.primarySession}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span className="text-rose-400">MARKET CLOSED ({session.closeReason})</span>
                <span className="text-neutral-400">•</span>
                <span>NY {session.nyTime12}</span>
              </div>
            )}
          </>
        )}
        {sessionCountdown && sessionAction && (
          <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${sessionAction === 'opens' ? 'text-amber-300' : 'text-emerald-300'}`}>
            <Clock3 className="h-3 w-3" />
            <span>MARKET {sessionAction.toUpperCase()} IN</span>
            <span className="font-mono text-neutral-100 tabular-nums">{sessionCountdown}</span>
          </div>
        )}
      </div>

      {activeTool !== 'cursor' && (
        <div role="status" aria-live="polite" className="absolute top-12 left-4 z-20 flex items-center space-x-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-md text-[11px] font-medium shadow-lg backdrop-blur-md animate-fadeIn">
          {activeTool === 'bar_replay' && <Scissors className="h-3.5 w-3.5 text-amber-400" />}
          {(activeTool === 'long_position' || activeTool === 'short_position') && (
            <Zap className={`h-3.5 w-3.5 ${activeTool === 'long_position' ? 'text-emerald-400' : 'text-rose-400'}`} />
          )}
          <span>{activeToolInstruction}</span>
          <button
            type="button"
            aria-label="Cancel active tool"
            title="Cancel (Esc)"
            onClick={onCancelTool}
            className="ml-2 hover:bg-amber-500/20 rounded p-0.5 text-amber-200 cursor-pointer"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </>
  );
}
