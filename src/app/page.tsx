'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { ReplayToolbar } from '@/components/ReplayToolbar';
import { Chart } from '@/components/Chart';
import { TradePanel } from '@/components/TradePanel';
import { TradeHistory } from '@/components/TradeHistory';
import { DataSelectorModal } from '@/components/DataSelectorModal';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';

export default function Home() {
  const [isDataSelectorOpen, setIsDataSelectorOpen] = useState(false);
  const fetchMarketData = useTradingSimulatorStore((s) => s.fetchMarketData);
  const candles = useTradingSimulatorStore((s) => s.candles);
  const replayStatus = useTradingSimulatorStore((s) => s.replayStatus);
  const play = useTradingSimulatorStore((s) => s.play);
  const pause = useTradingSimulatorStore((s) => s.pause);
  const stepForward = useTradingSimulatorStore((s) => s.stepForward);
  const resetReplay = useTradingSimulatorStore((s) => s.resetReplay);

  // Auto-load past 24 hours of XAUUSD on first visit
  useEffect(() => {
    if (candles.length === 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const yesterdaySec = nowSec - 24 * 60 * 60;
      fetchMarketData({
        startTime: yesterdaySec,
        endTime: nowSec,
        provider: 'bybit',
      });
    }
  }, [candles.length, fetchMarketData]);

  // Global Ergonomic Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (replayStatus === 'playing') {
          pause();
        } else {
          play();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        resetReplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [replayStatus, play, pause, stepForward, resetReplay]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08090c] font-sans text-neutral-100 select-none">
      {/* Top Header Command Bar */}
      <Header onOpenDataSelector={() => setIsDataSelectorOpen(true)} />

      {/* Replay Control Bar */}
      <ReplayToolbar />

      {/* Main Terminal Grid */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Stage: Candlestick Chart & Bottom Trade Ledger */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden border-r border-[#1c2230]">
          {/* Main Chart Canvas */}
          <div className="flex-1 relative min-h-[360px]">
            <Chart />
          </div>

          {/* Bottom Trade History & Stats Ledger */}
          <TradeHistory />
        </div>

        {/* Right Stage: Trading Desk (Order Placement & Position Spotlight) */}
        <div className="w-full lg:w-92 xl:w-96 shrink-0 h-auto lg:h-full overflow-y-auto bg-[#0a0d14]">
          <TradePanel />
        </div>
      </div>

      {/* Historical Data Range Modal */}
      <DataSelectorModal
        isOpen={isDataSelectorOpen}
        onClose={() => setIsDataSelectorOpen(false)}
      />
    </div>
  );
}
