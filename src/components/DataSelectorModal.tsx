'use client';

import React, { useEffect, useState } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { X, Calendar, Database, AlertCircle, Loader2, Check } from 'lucide-react';

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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoadingData) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoadingData, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoadingData) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-selector-title"
        className="my-auto w-full max-w-2xl overflow-hidden rounded-md border border-[#343e4b] bg-[#11151b] text-neutral-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#303844] bg-[#151a20] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#4b412e] bg-[#201d17] text-[#e3bd76]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 id="data-selector-title" className="text-lg font-semibold text-white">Historical market data</h2>
              <p className="mt-1 text-sm text-neutral-400">Choose a source, timeframe and date range for replay.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close historical market data"
            onClick={onClose}
            disabled={isLoadingData}
            className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-[#242a33] hover:text-white cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-5 p-6 text-sm">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-200">Market data source</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setProvider('bybit')}
                className={`min-h-28 rounded-md border p-4 text-left transition-colors cursor-pointer ${
                  provider === 'bybit'
                    ? 'border-[#a78345] bg-[#201d17] text-white'
                    : 'border-[#303844] bg-[#151a20] text-neutral-400 hover:border-[#56616e] hover:text-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>Bybit (Public API)</span>
                  <span className="rounded bg-[#202630] px-2 py-1 text-xs font-medium text-neutral-300">
                    Public
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-neutral-400">
                  Prefer Bybit TradFi XAUUSD.s gold pricing; falls back to the legacy XAUUSDT feed if needed.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('twelvedata')}
                className={`min-h-28 rounded-md border p-4 text-left transition-colors cursor-pointer ${
                  provider === 'twelvedata'
                    ? 'border-[#a78345] bg-[#201d17] text-white'
                    : 'border-[#303844] bg-[#151a20] text-neutral-400 hover:border-[#56616e] hover:text-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>Twelve Data</span>
                  <span className="rounded bg-[#202630] px-2 py-1 text-xs text-neutral-400">
                    API Key
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-neutral-400">
                  XAU/USD Forex Spot candles. Requires TWELVE_DATA_API_KEY.
                </div>
              </button>
            </div>
          </div>

          {/* Range Presets */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-200">Date range</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  className={`min-h-11 rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors cursor-pointer ${
                    preset === p.id
                      ? 'border-[#d6aa5b] bg-[#d6aa5b] text-[#15181c]'
                      : 'border-[#303844] bg-[#151a20] text-neutral-400 hover:bg-[#202630] hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candlestick Timeframe Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-200">Candle interval</label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`min-h-10 rounded-md border py-2 text-center font-mono text-sm font-medium transition-colors cursor-pointer ${
                    selectedTimeframe.toLowerCase() === tf.toLowerCase()
                      ? 'border-[#d6aa5b] bg-[#d6aa5b] text-[#15181c]'
                      : 'border-[#303844] bg-[#151a20] text-neutral-400 hover:bg-[#202630] hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                <Calendar className="h-4 w-4 text-neutral-500" />
                <span>Start Time (UTC)</span>
              </label>
              <input
                type="datetime-local"
                value={startDateStr}
                onChange={(e) => {
                  setStartDateStr(e.target.value);
                  setPreset('custom');
                }}
                className="min-h-11 w-full rounded-md border border-[#303844] bg-[#151a20] px-3 py-2 font-mono text-sm text-white focus:border-[#d6aa5b] focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                <Calendar className="h-4 w-4 text-neutral-500" />
                <span>End Time (UTC)</span>
              </label>
              <input
                type="datetime-local"
                value={endDateStr}
                onChange={(e) => {
                  setEndDateStr(e.target.value);
                  setPreset('custom');
                }}
                className="min-h-11 w-full rounded-md border border-[#303844] bg-[#151a20] px-3 py-2 font-mono text-sm text-white focus:border-[#d6aa5b] focus:outline-none"
              />
            </div>
          </div>

          {/* Info pill */}
          <div className="flex items-center gap-3 rounded-md border border-[#303844] bg-[#151a20] p-4 text-sm text-neutral-400">
            <Check className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>Candles are fetched and verified in real time, then replayed in local browser memory without persistent tracking.</span>
          </div>

          {/* Error Message */}
          {(localError || dataError) && (
            <div className="flex items-start gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <span>{localError || dataError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#303844] bg-[#151a20] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoadingData}
            className="min-h-11 rounded-md px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-[#242a33] hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoadingData}
            className="flex min-h-11 items-center gap-2 rounded-md bg-[#d6aa5b] px-5 py-2 text-sm font-semibold text-[#15181c] transition-colors hover:bg-[#e2bd78] disabled:opacity-50 cursor-pointer"
          >
            {isLoadingData ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Downloading Candles...</span>
              </>
            ) : (
              <span>Load candles</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
