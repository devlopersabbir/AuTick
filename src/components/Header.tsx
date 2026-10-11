'use client';

import React, { useEffect } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { Clock, TrendingUp, TrendingDown, Link2 } from 'lucide-react';
import { getSessionInfo } from '@/lib/utils/sessions';

interface HeaderProps {
  onOpenBrokerModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBrokerModal }) => {
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const currentIndex = useTradingSimulatorStore((s) => s.currentIndex);
  const candles = useTradingSimulatorStore((s) => s.candles);
  const totalCandles = candles.length;
  const replayStatus = useTradingSimulatorStore((s) => s.replayStatus);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);
  const changeTimeframe = useTradingSimulatorStore((s) => s.changeTimeframe);
  const isLoadingData = useTradingSimulatorStore((s) => s.isLoadingData);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);

  useEffect(() => {
    if (!currentCandle) {
      document.title = 'AuTick | XAUUSD Replay';
      return;
    }

    const price = currentCandle.close.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    document.title = `$${price} | XAUUSD | AuTick`;
  }, [currentCandle]);

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
    <header className="z-30 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#252c36] bg-[#101318] px-5 py-3.5 text-neutral-100">
      {/* Brand & Market Ticker */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-[#d6aa5b] text-base font-bold text-[#14171b]">
            Au
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-[#101318] ${replayStatus === 'playing' ? 'bg-emerald-400' : 'bg-[#d6aa5b]'}`}></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white">AuTick</span>
              <span className="border-l border-[#343e4b] pl-2 text-xs font-medium text-neutral-400">
                GOLD REPLAY
              </span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              Historical trading simulator
            </div>
          </div>
        </div>

        <div className="h-5 w-px bg-[#1c2230] hidden sm:block" />

        {/* Ticker, Timeframe Switcher & Live Price */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded border border-[#343e4b] bg-[#171c23] px-2.5 py-1 text-sm font-semibold text-[#e3bd76]">
            XAUUSD
          </span>

          {/* Timeframe selector bar */}
          <div className="flex items-center gap-0.5 rounded-md border border-[#303844] bg-[#14181e] p-1">
            {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => changeTimeframe(tf)}
                disabled={isLoadingData}
                title={`Switch to ${tf} candlestick interval`}
                className={`min-h-8 rounded px-2.5 py-1 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  currentTimeframe.toLowerCase() === tf.toLowerCase()
                    ? 'bg-[#d6aa5b] text-[#15181c]'
                    : 'text-neutral-400 hover:bg-[#242a33] hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {currentCandle ? (
            <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
              <span className="text-lg font-semibold tracking-tight text-white">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                isUp
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-rose-500/10 text-rose-300'
              }`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{isUp ? '+' : ''}{sessionChange.toFixed(2)} ({isUp ? '+' : ''}{sessionChangePercent.toFixed(2)}%)</span>
              </span>
            </div>
          ) : (
            <span className="text-sm text-neutral-500">Waiting for market data</span>
          )}
        </div>
      </div>

      {/* Center: High Visibility New York Market & Session Clock */}
      {(() => {
        const session = getSessionInfo(currentCandle?.timestamp || 0);
        return (
          <div className="hidden md:flex items-center gap-3 rounded-md border border-[#303844] bg-[#14181e] px-4 py-2">
            <Clock
              className={`h-4 w-4 ${
                session.isMarketOpen ? 'text-emerald-400' : 'text-neutral-500'
              }`}
            />
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                <span>{session.isMarketOpen ? 'NY Market Clock' : 'Market Closed'}</span>
                {session.isMarketOpen ? (
                  <span className="font-mono font-semibold text-emerald-400">
                    {session.primarySession}
                  </span>
                ) : (
                  <span className="font-mono font-medium text-neutral-400">
                    {session.closeReason}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-white tabular-nums">
                  {currentCandle ? session.nyFullDisplay : '--:-- --'}
                </span>
                <span className="font-mono text-xs text-neutral-500">
                  ({isLiveMode ? 'Real-Time' : `${progressPercent}%`})
                </span>
              </div>
            </div>
            {totalCandles > 0 && (
              <span className="rounded bg-[#202630] px-2 py-1 font-mono text-xs text-neutral-300">
                {currentIndex + 1}/{totalCandles}
              </span>
            )}
          </div>
        );
      })()}

      {/* Right: Compact broker connection action */}
      <div className="flex items-center">
        {/* Connect Broker Button */}
        <button
          type="button"
          onClick={onOpenBrokerModal}
          aria-label="Connect Bybit account"
          title="Connect Bybit account"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-[#303844] bg-[#171c23] text-neutral-300 transition-colors hover:border-[#a78345] hover:bg-[#201d17] hover:text-[#e3bd76]"
        >
          <Link2 className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
