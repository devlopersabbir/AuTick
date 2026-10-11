'use client';

import React, { useState } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  BarChart2,
  Keyboard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const TradeHistory: React.FC = () => {
  const tradeHistory = useTradingSimulatorStore((s) => s.tradeHistory);
  const [activeTab, setActiveTab] = useState<'trades' | 'stats' | 'rules'>('trades');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const formatUtcTime = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toISOString().replace('T', ' ').substring(11, 19);
  };

  // Performance calculations
  const totalTrades = tradeHistory.length;
  const winningTrades = tradeHistory.filter((t) => t.netPnl > 0);
  const losingTrades = tradeHistory.filter((t) => t.netPnl < 0);
  const totalWins = winningTrades.reduce((acc, t) => acc + t.netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.netPnl, 0));
  const totalNetPnl = tradeHistory.reduce((acc, t) => acc + t.netPnl, 0);

  const winRate = totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : '0.0';
  const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? '∞' : '0.00';
  const avgWin = winningTrades.length > 0 ? (totalWins / winningTrades.length).toFixed(2) : '0.00';
  const avgLoss = losingTrades.length > 0 ? (totalLosses / losingTrades.length).toFixed(2) : '0.00';

  return (
    <div className="flex flex-col border-t border-[#1c2230] bg-[#0c0e14] text-neutral-200 transition-all">
      {/* Top Header & Tabs Bar */}
      <div className="flex items-center justify-between border-b border-[#1c2230] px-4 py-2 bg-[#090b10]">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Tab 1: Trades */}
          <button
            onClick={() => {
              setActiveTab('trades');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'trades' && !isCollapsed
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Trade Ledger</span>
            <span className="rounded bg-[#1a2130] px-1.5 py-0.2 text-[10px] font-mono text-neutral-300">
              {totalTrades}
            </span>
          </button>

          {/* Tab 2: Analytics */}
          <button
            onClick={() => {
              setActiveTab('stats');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'stats' && !isCollapsed
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>Session Stats</span>
          </button>

          {/* Tab 3: Hotkeys & Rules */}
          <button
            onClick={() => {
              setActiveTab('rules');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rules' && !isCollapsed
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span>Shortcuts & Model</span>
          </button>
        </div>

        {/* Quick summary metrics & Collapse Toggle */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-4 text-xs font-mono tabular-nums">
            <span className="text-neutral-400">
              Win Rate: <strong className="text-white">{winRate}%</strong>
            </span>
            <span className="text-neutral-400">
              Net P&L:{' '}
              <strong className={totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {totalNetPnl >= 0 ? '+' : ''}${totalNetPnl.toFixed(2)}
              </strong>
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            className="p-1 text-neutral-400 hover:text-white hover:bg-[#182030] rounded cursor-pointer"
          >
            {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content Body */}
      {!isCollapsed && (
        <div className="max-h-52 min-h-24 overflow-y-auto">
          {activeTab === 'trades' && (
            <div>
              {totalTrades === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 italic">
                  No trades recorded yet in this session. Open a position to simulate execution.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="sticky top-0 bg-[#0e121c] text-[10px] text-neutral-400 uppercase tracking-wider border-b border-[#1c2230]">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Side</th>
                      <th className="px-3 py-2 font-semibold">Qty</th>
                      <th className="px-3 py-2 font-semibold">Entry Time (UTC)</th>
                      <th className="px-3 py-2 font-semibold">Entry Px</th>
                      <th className="px-3 py-2 font-semibold">Exit Time (UTC)</th>
                      <th className="px-3 py-2 font-semibold">Exit Px</th>
                      <th className="px-3 py-2 font-semibold">Exit Reason</th>
                      <th className="px-3 py-2 font-semibold text-right">Gross P&L</th>
                      <th className="px-4 py-2 font-semibold text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#161c28]">
                    {tradeHistory.slice().reverse().map((trade) => {
                      const isProfit = trade.netPnl >= 0;
                      return (
                        <tr key={trade.id} className="hover:bg-[#131724]/70 transition-colors">
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 font-bold text-xs ${
                              trade.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {trade.side === 'LONG' ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              {trade.side}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-neutral-300">{trade.quantity} oz</td>
                          <td className="px-3 py-2 text-neutral-400">{formatUtcTime(trade.entryTime)}</td>
                          <td className="px-3 py-2 text-white font-semibold">${trade.entryPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-neutral-400">{formatUtcTime(trade.exitTime)}</td>
                          <td className="px-3 py-2 text-white font-semibold">${trade.exitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              trade.exitReason === 'TP'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : trade.exitReason === 'SL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-[#1a2130] text-neutral-300 border border-[#2a344a]'
                            }`}>
                              {trade.exitReason === 'TP' && <CheckCircle2 className="h-3 w-3" />}
                              {trade.exitReason === 'SL' && <XCircle className="h-3 w-3" />}
                              {trade.exitReason === 'MANUAL' && <Clock className="h-3 w-3" />}
                              <span>{trade.exitReason === 'TP' ? 'Take Profit' : trade.exitReason === 'SL' ? 'Stop Loss' : 'Manual'}</span>
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.grossPnl >= 0 ? '+' : ''}${trade.grossPnl.toFixed(2)}
                          </td>
                          <td className={`px-4 py-2 text-right font-bold text-xs ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.netPnl >= 0 ? '+' : ''}${trade.netPnl.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="text-neutral-400 block text-[11px] mb-1">Win Rate</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums">{winRate}%</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">{winningTrades.length} Wins / {losingTrades.length} Losses</span>
              </div>

              <div className="rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="text-neutral-400 block text-[11px] mb-1">Profit Factor</span>
                <span className="font-mono text-lg font-bold text-amber-400 tabular-nums">{profitFactor}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">${totalWins.toFixed(2)} / ${totalLosses.toFixed(2)}</span>
              </div>

              <div className="rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="text-neutral-400 block text-[11px] mb-1">Avg Win</span>
                <span className="font-mono text-lg font-bold text-emerald-400 tabular-nums">+${avgWin}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">{winningTrades.length} profitable trades</span>
              </div>

              <div className="rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="text-neutral-400 block text-[11px] mb-1">Avg Loss</span>
                <span className="font-mono text-lg font-bold text-rose-400 tabular-nums">-${avgLoss}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">{losingTrades.length} losing trades</span>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-300">
              <div className="space-y-2 rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="font-bold text-white block uppercase tracking-wider text-[11px]">Keyboard Shortcuts</span>
                <ul className="space-y-1 font-mono text-[11px] text-neutral-400">
                  <li><kbd className="bg-[#192133] border border-[#26334f] px-1.5 py-0.5 rounded text-white mr-2">Space</kbd> Play / Pause Replay</li>
                  <li><kbd className="bg-[#192133] border border-[#26334f] px-1.5 py-0.5 rounded text-white mr-2">→</kbd> Step Forward 1 Candle (1 minute)</li>
                  <li><kbd className="bg-[#192133] border border-[#26334f] px-1.5 py-0.5 rounded text-white mr-2">R</kbd> Reset Replay to Start</li>
                </ul>
              </div>

              <div className="space-y-2 rounded-lg bg-[#10141f] border border-[#1e2638] p-3">
                <span className="font-bold text-white block uppercase tracking-wider text-[11px]">Execution Model</span>
                <ul className="space-y-1 text-[11px] text-neutral-400 leading-relaxed">
                  <li>• Market entries fill at current candle Close.</li>
                  <li>• Stop Loss and Take Profit trigger on subsequent historical candles.</li>
                  <li>• Conservative assumption: When a candle touches both SL and TP, Stop Loss triggers first.</li>
                  <li>• 100% in-memory: Page refresh starts a fresh clean session.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
