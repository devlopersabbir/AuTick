'use client';

import React from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { Calendar, Clock, Database, TrendingUp, TrendingDown, Link2 } from 'lucide-react';
import { getSessionInfo } from '@/lib/utils/sessions';

interface HeaderProps {
  onOpenBrokerModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBrokerModal }) => {
  const metadata = useTradingSimulatorStore((s) => s.metadata);
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const candles = useTradingSimulatorStore((s) => s.candles);
  const totalCandles = candles.length;
  const replayStatus = useTradingSimulatorStore((s) => s.replayStatus);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);
  const changeTimeframe = useTradingSimulatorStore((s) => s.changeTimeframe);
  const isLoadingData = useTradingSimulatorStore((s) => s.isLoadingData);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);

  // Price calculations
  const firstCandle = candles[0];
  const currentPrice = currentCandle ? currentCandle.close : 0;
  const initialPrice = firstCandle ? firstCandle.open : currentPrice;
  const sessionChange = currentPrice - initialPrice;
  const sessionChangePercent = initialPrice > 0 ? (sessionChange / initialPrice) * 100 : 0;
  const isUp = sessionChange >= 0;

  const progressPercent = totalCandles > 0 && currentIndex >= 0
    ? Math.round(((currentIndex + 1) / totalCandles) * 100)
    : 0;

  return (
    <header className="flex flex-wrap items-center justify-between border-b border-[#1c2230] bg-[#0c0e14]/95 backdrop-blur-md px-4 py-2 text-neutral-100 z-30">
      {/* Brand & Market Ticker */}
      <div className="flex items-center space-x-4">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 font-extrabold text-black shadow-md shadow-amber-500/20 text-sm">
            Au
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${replayStatus === 'playing' ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${replayStatus === 'playing' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-bold tracking-tight text-white">AuTick</span>
              <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-amber-400 uppercase tracking-wider">
                Pro
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 font-medium tracking-wide">
              XAUUSD Replay Terminal
            </div>
          </div>
        </div>

        <div className="h-5 w-px bg-[#1c2230] hidden sm:block" />

        {/* Ticker, Timeframe Switcher & Live Price */}
        <div className="flex items-center space-x-3">
          <span className="rounded bg-[#161b26] border border-[#232b3d] px-2 py-0.5 text-xs font-bold text-amber-400">
            XAU/USD
          </span>

          {/* Timeframe selector bar */}
          <div className="flex items-center space-x-0.5 rounded-lg border border-[#1e2638] bg-[#10141f] p-0.5">
            {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => changeTimeframe(tf)}
                disabled={isLoadingData}
                title={`Switch to ${tf} candlestick interval`}
                className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  currentTimeframe.toLowerCase() === tf.toLowerCase()
                    ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#161c2b]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {currentCandle ? (
            <div className="flex items-center space-x-2 font-mono tabular-nums">
              <span className="text-base font-extrabold text-white">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`flex items-center space-x-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                isUp
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{isUp ? '+' : ''}{sessionChange.toFixed(2)} ({isUp ? '+' : ''}{sessionChangePercent.toFixed(2)}%)</span>
              </span>
            </div>
          ) : (
            <span className="text-xs font-mono text-neutral-500">Awaiting market data...</span>
          )}
        </div>
      </div>

      {/* Center: High Visibility New York Market & Session Clock */}
      {(() => {
        const session = getSessionInfo(currentCandle?.timestamp || 0);
        return (
          <div className="hidden md:flex items-center space-x-3 rounded-lg border border-[#1e2638] bg-[#10141f] px-3.5 py-1 shadow-inner">
            <Clock
              className={`h-4 w-4 ${
                session.isMarketOpen ? 'text-emerald-400 animate-pulse' : 'text-rose-400 animate-pulse'
              }`}
            />
            <div className="flex flex-col">
              <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-neutral-400 gap-3">
                <span>{session.isMarketOpen ? 'NY Market Clock' : 'Market Closed'}</span>
                {session.isMarketOpen ? (
                  <span className="text-emerald-400 font-mono font-bold">
                    ● {session.primarySession}
                  </span>
                ) : (
                  <span className="text-rose-400 font-mono font-bold">
                    🔴 {session.closeReason}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold tracking-tight text-white tabular-nums">
                  {currentCandle ? session.nyFullDisplay : '--:-- --'}
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  ({isLiveMode ? 'Real-Time' : `${progressPercent}%`})
                </span>
              </div>
            </div>
            {totalCandles > 0 && (
              <span className="text-[10px] font-mono text-neutral-400 bg-[#161d2d] px-1.5 py-0.5 rounded">
                {currentIndex + 1}/{totalCandles}
              </span>
            )}
          </div>
        );
      })()}

      {/* Right: Dataset Stats & Actions */}
      <div className="flex items-center space-x-3 text-xs">
        {metadata && (
          <div className="hidden xl:flex items-center space-x-3 text-neutral-400 bg-[#10141f] border border-[#1e2638] rounded-lg px-2.5 py-1">
            <div className="flex items-center space-x-1">
              <Database className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-neutral-300 font-medium">{metadata.provider}</span>
            </div>
            <span className="text-neutral-600">•</span>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              <span className="font-mono text-[11px] text-neutral-300">
                {new Date(metadata.startTime * 1000).toISOString().substring(5, 16)} →{' '}
                {new Date(metadata.endTime * 1000).toISOString().substring(5, 16)}
              </span>
            </div>
          </div>
        )}

        {/* Connect Broker Button */}
        <button
          type="button"
          onClick={onOpenBrokerModal}
          title="Connect a broker account"
          className="flex items-center space-x-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors shadow-sm hover:border-amber-500"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>Connect Broker</span>
        </button>
      </div>
    </header>
  );
};
