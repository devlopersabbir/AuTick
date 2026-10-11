'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { ReplayToolbar } from '@/components/ReplayToolbar';
import { DrawingToolbar } from '@/components/DrawingToolbar';
import { Chart } from '@/components/Chart';
import { TradePanel } from '@/components/TradePanel';
import { TradeHistory } from '@/components/TradeHistory';
import { DataSelectorModal } from '@/components/DataSelectorModal';
import { BrokerSelectorModal } from '@/components/BrokerSelectorModal';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';

export default function Home() {
  const [isDataSelectorOpen, setIsDataSelectorOpen] = useState(false);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const fetchMarketData = useTradingSimulatorStore((s) => s.fetchMarketData);
  const candles = useTradingSimulatorStore((s) => s.candles);
  const replayStatus = useTradingSimulatorStore((s) => s.replayStatus);
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);
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
      // Ignore keyboard shortcuts when typing in inputs or textareas
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
      } else if (e.code === 'KeyC' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool(activeTool === 'bar_replay' ? 'cursor' : 'bar_replay');
      } else if (e.code === 'KeyV' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool('cursor');
      } else if (e.code === 'Escape') {
        setActiveTool('cursor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [replayStatus, play, pause, stepForward, resetReplay, activeTool, setActiveTool]);

  return (
    <div className="flex h-dvh min-h-[560px] w-screen flex-col overflow-hidden bg-[#0b0e12] font-sans text-neutral-100 max-lg:h-auto max-lg:min-h-dvh max-lg:overflow-y-auto">
      {/* Top Header Command Bar */}
      <Header onOpenBrokerModal={() => setIsBrokerModalOpen(true)} />

      {/* Replay Control Bar */}
      <ReplayToolbar />

      {/* Main Terminal Grid */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row max-lg:overflow-visible">
        {/* Left Stage: Candlestick Chart & Bottom Trade Ledger */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[#252c36] max-lg:overflow-visible">
          {/* Main Chart Canvas with Left Drawing Toolbar */}
          <div className="flex-1 relative min-h-[360px] flex flex-row overflow-hidden">
            {/* TradingView-style Left Drawing Toolbar */}
            <DrawingToolbar />

            {/* TradingView Chart Canvas & Overlay */}
            <Chart />
          </div>

          {/* Bottom Trade History & Stats Ledger */}
          <TradeHistory />
        </div>

        {/* Right Stage: Trading Desk (Order Placement & Position Spotlight) */}
        <div className="w-full shrink-0 h-auto overflow-y-auto bg-[#0a0d14] lg:h-full lg:w-72 xl:w-80">
          <TradePanel />
        </div>
      </div>

      {/* Historical Data Range Modal */}
      <DataSelectorModal
        isOpen={isDataSelectorOpen}
        onClose={() => setIsDataSelectorOpen(false)}
      />

      <BrokerSelectorModal
        isOpen={isBrokerModalOpen}
        onClose={() => setIsBrokerModalOpen(false)}
        onOpenHistoricalRange={() => {
          setIsBrokerModalOpen(false);
          setIsDataSelectorOpen(true);
        }}
      />
    </div>
  );
}
