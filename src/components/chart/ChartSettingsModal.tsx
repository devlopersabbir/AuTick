'use client';

import { useEffect } from 'react';
import { Activity, X } from 'lucide-react';

interface ChartSettingsModalProps {
  isOpen: boolean;
  breakoutEnabled: boolean;
  onToggleBreakout: (enabled: boolean) => void;
  onClose: () => void;
}

export function ChartSettingsModal({
  isOpen,
  breakoutEnabled,
  onToggleBreakout,
  onClose,
}: ChartSettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-end bg-black/35 p-4 pt-14 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-settings-title"
        className="w-full max-w-sm rounded-lg border border-[#303844] bg-[#10151e] p-4 shadow-2xl"
      >
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="chart-settings-title" className="text-sm font-semibold text-white">Chart settings</h2>
            <p className="mt-1 text-xs text-neutral-500">Indicators for the active chart</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart settings"
            className="rounded p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="rounded-md border border-[#252d3a] bg-[#141a24] p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-500/10 text-amber-300">
              <Activity className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-neutral-100">Breakout signals</span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">
                Mark a closed candle when it breaks above or below the previous 20 candles’ range.
                Uses the selected chart timeframe and appears in live mode.
              </span>
            </span>
            <input
              type="checkbox"
              checked={breakoutEnabled}
              onChange={(event) => onToggleBreakout(event.target.checked)}
              aria-label="Enable breakout signals"
              className="mt-1 h-4 w-4 accent-amber-400"
            />
          </label>
        </div>

        <p className="mt-3 text-[11px] text-neutral-500">
          Indicator preferences are saved in this browser.
        </p>
      </section>
    </div>
  );
}
