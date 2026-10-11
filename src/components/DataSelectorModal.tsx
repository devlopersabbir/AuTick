'use client';

import React, { useState } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { X, Calendar, Database, AlertCircle, Loader2, Sparkles, Check } from 'lucide-react';

interface DataSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSelectorModal: React.FC<DataSelectorModalProps> = ({ isOpen, onClose }) => {
  const fetchMarketData = useTradingSimulatorStore((s) => s.fetchMarketData);
  const isLoadingData = useTradingSimulatorStore((s) => s.isLoadingData);
  const dataError = useTradingSimulatorStore((s) => s.dataError);
  const currentTimeframe = useTradingSimulatorStore((s) => s.currentTimeframe);

  const [provider, setProvider] = useState<string>('bybit');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(currentTimeframe || '1m');
  const [preset, setPreset] = useState<'24h' | '3d' | '7d' | 'custom'>('24h');

  const [startDateStr, setStartDateStr] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const now = new Date();
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().substring(0, 16);
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return new Date().toISOString().substring(0, 16);
  });
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (p: '24h' | '3d' | '7d' | 'custom') => {
    setPreset(p);
    const end = new Date();
    let startMs = end.getTime() - 24 * 60 * 60 * 1000;

    if (p === '3d') {
      startMs = end.getTime() - 3 * 24 * 60 * 60 * 1000;
    } else if (p === '7d') {
      startMs = end.getTime() - 7 * 24 * 60 * 60 * 1000;
    }

    if (p !== 'custom') {
      setStartDateStr(new Date(startMs).toISOString().substring(0, 16));
      setEndDateStr(end.toISOString().substring(0, 16));
    }
  };

  const handleFetch = async () => {
    setLocalError(null);

    const start = new Date(startDateStr + ':00Z');
    const end = new Date(endDateStr + ':00Z');

    const startTimeSec = Math.floor(start.getTime() / 1000);
    const endTimeSec = Math.floor(end.getTime() / 1000);

    if (isNaN(startTimeSec) || isNaN(endTimeSec)) {
      setLocalError('Invalid start or end date/time.');
      return;
    }

    if (startTimeSec >= endTimeSec) {
      setLocalError('Start time must be strictly before end time.');
      return;
    }

    const success = await fetchMarketData({
      startTime: startTimeSec,
      endTime: endTimeSec,
      provider,
      timeframe: selectedTimeframe,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-[#232c3f] bg-[#0e121c] shadow-2xl text-neutral-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2738] px-5 py-4 bg-[#0a0d15]">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Load Historical Market Range</h2>
              <p className="text-[11px] text-neutral-400">Configure 1-minute gold candles for simulation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold text-xs">Market Data Provider</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setProvider('bybit')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  provider === 'bybit'
                    ? 'border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-950/30'
                    : 'border-[#1e2638] bg-[#121624] text-neutral-400 hover:text-white hover:border-[#2a354c]'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between mb-1">
                  <span>Bybit (Public API)</span>
                  <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    Recommended
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 leading-tight">
                  Prefer Bybit TradFi XAUUSD.s gold pricing; falls back to the legacy XAUUSDT feed if needed.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('twelvedata')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  provider === 'twelvedata'
                    ? 'border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-950/30'
                    : 'border-[#1e2638] bg-[#121624] text-neutral-400 hover:text-white hover:border-[#2a354c]'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between mb-1">
                  <span>Twelve Data</span>
                  <span className="text-[10px] text-neutral-400 bg-[#1e2638] px-1.5 py-0.2 rounded font-mono">
                    API Key
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 leading-tight">
                  XAU/USD Forex Spot candles. Requires TWELVE_DATA_API_KEY.
                </div>
              </button>
            </div>
          </div>

          {/* Range Presets */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold text-xs">Historical Range Presets</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '24h', label: 'Last 24 Hours' },
                { id: '3d', label: 'Last 3 Days' },
                { id: '7d', label: 'Last 7 Days' },
                { id: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.id as typeof preset)}
                  className={`py-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer ${
                    preset === p.id
                      ? 'border-amber-500 bg-amber-500 text-black shadow-md shadow-amber-950/30'
                      : 'border-[#1e2638] bg-[#121624] text-neutral-400 hover:text-white hover:bg-[#182030]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candlestick Timeframe Selector */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold text-xs">Candlestick Timeframe Interval</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`py-1.5 rounded-lg border text-center font-mono font-bold text-xs transition-all cursor-pointer ${
                    selectedTimeframe.toLowerCase() === tf.toLowerCase()
                      ? 'border-amber-500 bg-amber-500 text-black shadow-md shadow-amber-950/30'
                      : 'border-[#1e2638] bg-[#121624] text-neutral-400 hover:text-white hover:bg-[#182030]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-neutral-400 flex items-center gap-1 font-medium text-[11px]">
                <Calendar className="h-3 w-3 text-neutral-500" />
                <span>Start Time (UTC)</span>
              </label>
              <input
                type="datetime-local"
                value={startDateStr}
                onChange={(e) => {
                  setStartDateStr(e.target.value);
                  setPreset('custom');
                }}
                className="w-full rounded-lg border border-[#232b3d] bg-[#121624] px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 flex items-center gap-1 font-medium text-[11px]">
                <Calendar className="h-3 w-3 text-neutral-500" />
                <span>End Time (UTC)</span>
              </label>
              <input
                type="datetime-local"
                value={endDateStr}
                onChange={(e) => {
                  setEndDateStr(e.target.value);
                  setPreset('custom');
                }}
                className="w-full rounded-lg border border-[#232b3d] bg-[#121624] px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Info pill */}
          <div className="rounded-xl border border-[#1b2333] bg-[#0b0e17] p-3 text-[11px] text-neutral-400 flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Candles are fetched and verified in real time, then replayed in local browser memory without persistent tracking.</span>
          </div>

          {/* Error Message */}
          {(localError || dataError) && (
            <div className="flex items-start space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{localError || dataError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2.5 border-t border-[#1f2738] bg-[#0a0d15] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoadingData}
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoadingData}
            className="flex items-center space-x-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            {isLoadingData ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Downloading Candles...</span>
              </>
            ) : (
              <span>Load Candles & Reset Replay</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
