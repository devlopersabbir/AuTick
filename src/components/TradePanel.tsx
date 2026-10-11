'use client';

import React, { useState } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { PositionSide } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  XCircle,
  AlertTriangle,
  Shield,
  Target,
  Wallet,
  Coins,
  ArrowRight,
} from 'lucide-react';

export const TradePanel: React.FC = () => {
  const currentCandle = useTradingSimulatorStore((s) => s.currentCandle);
  const openPosition = useTradingSimulatorStore((s) => s.openPosition);
  const balance = useTradingSimulatorStore((s) => s.balance);
  const equity = useTradingSimulatorStore((s) => s.equity);
  const initialBalance = useTradingSimulatorStore((s) => s.initialBalance);
  const tradeHistory = useTradingSimulatorStore((s) => s.tradeHistory);
  const orderError = useTradingSimulatorStore((s) => s.orderError);
  const openOrder = useTradingSimulatorStore((s) => s.openOrder);
  const closeCurrentPosition = useTradingSimulatorStore((s) => s.closeCurrentPosition);
  const clearErrors = useTradingSimulatorStore((s) => s.clearErrors);

  // Form states
  const [selectedSide, setSelectedSide] = useState<PositionSide>('LONG');
  const [quantity, setQuantity] = useState<string>('1.0');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);

  const currentPrice = currentCandle ? currentCandle.close : 0;
  const isPositionOpen = openPosition !== null;

  // Session statistics
  const totalRealizedPnl = balance - initialBalance;
  const totalTrades = tradeHistory.length;
  const winningTrades = tradeHistory.filter((t) => t.netPnl > 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(0) : '0';

  // Quick preset offsets
  const applyPresetSl = (dollars: number) => {
    if (!currentPrice) return;
    if (selectedSide === 'LONG') {
      setStopLoss((currentPrice - dollars).toFixed(2));
    } else {
      setStopLoss((currentPrice + dollars).toFixed(2));
    }
  };

  const applyPresetTp = (dollars: number) => {
    if (!currentPrice) return;
    if (selectedSide === 'LONG') {
      setTakeProfit((currentPrice + dollars).toFixed(2));
    } else {
      setTakeProfit((currentPrice - dollars).toFixed(2));
    }
  };

  const handleOpenPosition = () => {
    setFormValidationMsg(null);
    clearErrors();

    if (!currentCandle) {
      setFormValidationMsg('No active market price available. Please load data first.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormValidationMsg('Please enter a valid positive quantity.');
      return;
    }

    const sl = stopLoss.trim() !== '' ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit.trim() !== '' ? parseFloat(takeProfit) : undefined;

    if (sl !== undefined && isNaN(sl)) {
      setFormValidationMsg('Stop Loss must be a valid number.');
      return;
    }
    if (tp !== undefined && isNaN(tp)) {
      setFormValidationMsg('Take Profit must be a valid number.');
      return;
    }

    if (selectedSide === 'LONG') {
      if (sl !== undefined && sl >= currentPrice) {
        setFormValidationMsg(`Stop Loss (${sl}) must be below current price (${currentPrice.toFixed(2)}) for LONG.`);
        return;
      }
      if (tp !== undefined && tp <= currentPrice) {
        setFormValidationMsg(`Take Profit (${tp}) must be above current price (${currentPrice.toFixed(2)}) for LONG.`);
        return;
      }
    } else {
      if (sl !== undefined && sl <= currentPrice) {
        setFormValidationMsg(`Stop Loss (${sl}) must be above current price (${currentPrice.toFixed(2)}) for SHORT.`);
        return;
      }
      if (tp !== undefined && tp >= currentPrice) {
        setFormValidationMsg(`Take Profit (${tp}) must be below current price (${currentPrice.toFixed(2)}) for SHORT.`);
        return;
      }
    }

    const ok = openOrder({
      side: selectedSide,
      quantity: qty,
      stopLoss: sl,
      takeProfit: tp,
    });

    if (ok) {
      setStopLoss('');
      setTakeProfit('');
      setFormValidationMsg(null);
    }
  };

  // Risk / Reward preview calculation
  const slNum = stopLoss.trim() !== '' ? parseFloat(stopLoss) : null;
  const tpNum = takeProfit.trim() !== '' ? parseFloat(takeProfit) : null;
  const parsedQty = parseFloat(quantity) || 1;
  let riskDollars = 0;
  let rewardDollars = 0;
  let riskRewardRatio = '';

  if (currentPrice > 0) {
    if (slNum !== null && !isNaN(slNum)) {
      riskDollars = Math.abs(currentPrice - slNum) * parsedQty;
    }
    if (tpNum !== null && !isNaN(tpNum)) {
      rewardDollars = Math.abs(currentPrice - tpNum) * parsedQty;
    }
    if (riskDollars > 0 && rewardDollars > 0) {
      riskRewardRatio = `1 : ${(rewardDollars / riskDollars).toFixed(2)}`;
    }
  }

  // Calculate position progress between SL and TP
  let positionProgressPercent = 50;
  if (openPosition && openPosition.stopLoss && openPosition.takeProfit) {
    const sl = openPosition.stopLoss;
    const tp = openPosition.takeProfit;
    const cur = openPosition.currentPrice;
    if (openPosition.side === 'LONG' && tp > sl) {
      positionProgressPercent = Math.max(0, Math.min(100, ((cur - sl) / (tp - sl)) * 100));
    } else if (openPosition.side === 'SHORT' && sl > tp) {
      positionProgressPercent = Math.max(0, Math.min(100, ((sl - cur) / (sl - tp)) * 100));
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0d14] border-l border-[#1c2230] text-neutral-100 p-4 space-y-4 overflow-y-auto">
      {/* Account Performance HUD Card */}
      <div className="rounded-xl border border-[#1e2638] bg-gradient-to-b from-[#121624] to-[#0d101a] p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-neutral-400">
          <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider">
            <Wallet className="h-3.5 w-3.5 text-amber-400" />
            <span>Simulated Account</span>
          </div>
          <span className="rounded bg-[#1a2030] px-2 py-0.5 text-[10px] font-mono text-neutral-300">
            Win Rate: <strong className="text-white">{winRate}%</strong> ({winningTrades}/{totalTrades})
          </span>
        </div>

        {/* Equity & Balance Big Numbers */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-[#0a0d14]/80 border border-[#1b2233] p-2.5">
            <span className="text-[10px] text-neutral-400 font-medium block">Net Equity</span>
            <div className={`font-mono text-base font-extrabold tabular-nums ${equity >= balance ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="rounded-lg bg-[#0a0d14]/80 border border-[#1b2233] p-2.5">
            <span className="text-[10px] text-neutral-400 font-medium block">Cash Balance</span>
            <div className="font-mono text-base font-extrabold text-white tabular-nums">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Realized vs Unrealized P&L */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0f131f] border border-[#182030]">
            <span className="text-[11px] text-neutral-400">Realized:</span>
            <span className={`font-mono font-bold tabular-nums ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0f131f] border border-[#182030]">
            <span className="text-[11px] text-neutral-400">Unrealized:</span>
            <span className={`font-mono font-bold tabular-nums ${
              openPosition
                ? openPosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                : 'text-neutral-500'
            }`}>
              {openPosition
                ? `${openPosition.unrealizedPnl >= 0 ? '+' : ''}$${openPosition.unrealizedPnl.toFixed(2)}`
                : '$0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Position Spotlight Card */}
      {isPositionOpen && openPosition ? (
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-[#161c2b] to-[#0e121c] p-4 space-y-3.5 shadow-xl glow-gold">
          <div className="flex items-center justify-between border-b border-[#222b3d] pb-2.5">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wide flex items-center space-x-1 ${
                openPosition.side === 'LONG'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}>
                {openPosition.side === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{openPosition.side}</span>
              </span>
              <span className="font-mono text-xs font-semibold text-neutral-200">
                {openPosition.quantity} oz
              </span>
            </div>

            {/* Live Unrealized P&L Display */}
            <div className="text-right">
              <div className={`font-mono text-base font-extrabold tabular-nums ${
                openPosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {openPosition.unrealizedPnl >= 0 ? '+' : ''}${openPosition.unrealizedPnl.toFixed(2)}
              </div>
              <div className={`text-[10px] font-mono font-medium ${
                openPosition.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {openPosition.entryPrice > 0 ? (
                  `${openPosition.unrealizedPnl >= 0 ? '+' : ''}${(
                    (openPosition.unrealizedPnl / (openPosition.entryPrice * openPosition.quantity)) * 100
                  ).toFixed(2)}%`
                ) : '0%'}
              </div>
            </div>
          </div>

          {/* Position Parameters */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
            <div className="rounded bg-[#0c101a] p-2 border border-[#1a2233]">
              <span className="text-[10px] text-neutral-500 block">Entry Price</span>
              <span className="text-neutral-200 font-semibold">${openPosition.entryPrice.toFixed(2)}</span>
            </div>
            <div className="rounded bg-[#0c101a] p-2 border border-[#1a2233]">
              <span className="text-[10px] text-neutral-500 block">Market Price</span>
              <span className="text-white font-bold">${openPosition.currentPrice.toFixed(2)}</span>
            </div>
            <div className="rounded bg-[#0c101a] p-2 border border-[#1a2233]">
              <span className="text-[10px] text-neutral-500 block flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-rose-400" /> Stop Loss
              </span>
              <span className="text-rose-400 font-medium">
                {openPosition.stopLoss ? `$${openPosition.stopLoss.toFixed(2)}` : 'None'}
              </span>
            </div>
            <div className="rounded bg-[#0c101a] p-2 border border-[#1a2233]">
              <span className="text-[10px] text-neutral-500 block flex items-center gap-1">
                <Target className="h-2.5 w-2.5 text-emerald-400" /> Take Profit
              </span>
              <span className="text-emerald-400 font-medium">
                {openPosition.takeProfit ? `$${openPosition.takeProfit.toFixed(2)}` : 'None'}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar to SL / TP */}
          {openPosition.stopLoss && openPosition.takeProfit && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span className="text-rose-400">SL: ${openPosition.stopLoss.toFixed(0)}</span>
                <span className="text-neutral-300">Progress</span>
                <span className="text-emerald-400">TP: ${openPosition.takeProfit.toFixed(0)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#182030] overflow-hidden p-0.5 border border-[#222b3d]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${positionProgressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Prominent Close Button */}
          <button
            onClick={() => closeCurrentPosition()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-950/60 cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>CLOSE POSITION @ MARKET (${openPosition.currentPrice.toFixed(2)})</span>
          </button>
        </div>
      ) : null}

      {/* Order Placement Terminal Form */}
      <div className={`rounded-xl border border-[#1e2638] bg-[#0d101a] p-4 space-y-4 ${
        isPositionOpen ? 'opacity-40 pointer-events-none' : ''
      }`}>
        <div className="flex items-center justify-between border-b border-[#1c2230] pb-2">
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span>Order Entry Terminal</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">1 Position Max</span>
        </div>

        {/* Big Side Toggle Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSelectedSide('LONG')}
            disabled={isPositionOpen}
            className={`flex flex-col items-center justify-center py-2.5 rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
              selectedSide === 'LONG'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 glow-bull'
                : 'bg-[#10141f] border-[#1e2638] text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>BUY / LONG</span>
            </div>
            <span className="text-[10px] font-normal text-neutral-400 font-mono">
              ${currentPrice ? currentPrice.toFixed(2) : '--'}
            </span>
          </button>

          <button
            onClick={() => setSelectedSide('SHORT')}
            disabled={isPositionOpen}
            className={`flex flex-col items-center justify-center py-2.5 rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
              selectedSide === 'SHORT'
                ? 'bg-rose-600/20 border-rose-500 text-rose-400 glow-bear'
                : 'bg-[#10141f] border-[#1e2638] text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center space-x-1">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>SELL / SHORT</span>
            </div>
            <span className="text-[10px] font-normal text-neutral-400 font-mono">
              ${currentPrice ? currentPrice.toFixed(2) : '--'}
            </span>
          </button>
        </div>

        {/* Position Size / Quantity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Quantity (Troy Ounces)</span>
            <span className="font-mono text-[10px] text-neutral-500">
              Value ≈ ${currentPrice && parsedQty ? (currentPrice * parsedQty).toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPositionOpen}
              className="w-full rounded-lg border border-[#232b3d] bg-[#121624] px-3.5 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none tabular-nums"
            />
            <span className="absolute right-3 top-2 text-xs font-mono text-neutral-400 font-semibold pointer-events-none">
              oz
            </span>
          </div>
          <div className="flex gap-1.5 pt-0.5">
            {['0.1', '0.5', '1.0', '2.0', '5.0'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantity(q)}
                disabled={isPositionOpen}
                className="flex-1 rounded-md border border-[#1e2638] bg-[#10141f] hover:bg-[#182030] py-1 text-[11px] font-mono text-neutral-300 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss Input with Quick Offsets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1 font-medium">
              <Shield className="h-3 w-3 text-rose-400" />
              <span>Stop Loss</span>
            </span>
            {riskDollars > 0 && (
              <span className="text-[11px] font-mono font-semibold text-rose-400 tabular-nums">
                Risk: -${riskDollars.toFixed(2)}
              </span>
            )}
          </div>
          <input
            type="number"
            step="0.1"
            placeholder={
              currentPrice
                ? selectedSide === 'LONG'
                  ? `< ${(currentPrice - 5).toFixed(2)}`
                  : `> ${(currentPrice + 5).toFixed(2)}`
                : 'Stop Price'
            }
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            disabled={isPositionOpen}
            className="w-full rounded-lg border border-[#232b3d] bg-[#121624] px-3.5 py-2 font-mono text-xs text-white focus:border-rose-500 focus:outline-none tabular-nums"
          />
          <div className="flex gap-1.5 pt-0.5">
            {[5, 10, 20].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyPresetSl(d)}
                disabled={isPositionOpen || !currentPrice}
                className="flex-1 rounded-md border border-[#1e2638] bg-[#10141f] hover:bg-rose-500/10 hover:border-rose-500/30 py-1 text-[11px] font-mono text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                -${d}
              </button>
            ))}
          </div>
        </div>

        {/* Take Profit Input with Quick Offsets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1 font-medium">
              <Target className="h-3 w-3 text-emerald-400" />
              <span>Take Profit</span>
            </span>
            {rewardDollars > 0 && (
              <span className="text-[11px] font-mono font-semibold text-emerald-400 tabular-nums">
                Reward: +${rewardDollars.toFixed(2)}
              </span>
            )}
          </div>
          <input
            type="number"
            step="0.1"
            placeholder={
              currentPrice
                ? selectedSide === 'LONG'
                  ? `> ${(currentPrice + 10).toFixed(2)}`
                  : `< ${(currentPrice - 10).toFixed(2)}`
                : 'Target Price'
            }
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            disabled={isPositionOpen}
            className="w-full rounded-lg border border-[#232b3d] bg-[#121624] px-3.5 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none tabular-nums"
          />
          <div className="flex gap-1.5 pt-0.5">
            {[10, 20, 40].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyPresetTp(d)}
                disabled={isPositionOpen || !currentPrice}
                className="flex-1 rounded-md border border-[#1e2638] bg-[#10141f] hover:bg-emerald-500/10 hover:border-emerald-500/30 py-1 text-[11px] font-mono text-neutral-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                +${d}
              </button>
            ))}
          </div>
        </div>

        {/* Risk / Reward ratio visual card */}
        {riskRewardRatio && (
          <div className="flex items-center justify-between rounded-lg bg-[#111624] border border-[#1f283d] px-3 py-2 text-xs">
            <span className="text-neutral-400 font-medium">Risk / Reward Ratio</span>
            <span className="font-mono font-extrabold text-amber-400">{riskRewardRatio}</span>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          onClick={handleOpenPosition}
          disabled={isPositionOpen || !currentCandle}
          className={`w-full py-3 rounded-lg font-extrabold text-xs transition-all shadow-xl cursor-pointer flex items-center justify-center space-x-2 ${
            selectedSide === 'LONG'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-950/50'
              : 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-950/50'
          }`}
        >
          <span>{isPositionOpen ? 'Position Already Active' : `SUBMIT ${selectedSide} ORDER`}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Validation / Error banner */}
      {(formValidationMsg || orderError) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start space-x-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1 leading-snug">
            <strong className="block text-rose-200 font-bold mb-0.5">Order Rejected:</strong>
            <span>{formValidationMsg || orderError}</span>
          </div>
        </div>
      )}
    </div>
  );
};
