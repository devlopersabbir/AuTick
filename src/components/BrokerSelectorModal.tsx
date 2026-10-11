'use client';

import React, { useEffect } from 'react';
import { ArrowUpRight, CalendarRange, Check, X } from 'lucide-react';

interface BrokerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistoricalRange: () => void;
}

export const BrokerSelectorModal: React.FC<BrokerSelectorModalProps> = ({
  isOpen,
  onClose,
  onOpenHistoricalRange,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-selector-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-[#273044] bg-[#0d111a] text-neutral-100 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#20283a] px-5 py-4">
          <div>
            <h2 id="broker-selector-title" className="text-base font-bold text-white">
              Connect a broker
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Choose a broker for market data and account details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close broker selector"
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-300">Available brokers</h3>
            <span className="text-[10px] text-neutral-500">1 listed</span>
          </div>

          <article className="rounded-lg border border-[#343044] bg-[#131722] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#f7a600]/10 text-[11px] font-black text-[#f7a600]">
                BYBIT
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Bybit</h4>
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                    TradFi / MT5
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                  Link your Bybit account to view the matching gold price and account balance.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-[#262d3c] pt-3 text-[11px] text-neutral-400">
              <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Account linking setup is in progress.</span>
            </div>
          </article>

          <p className="mt-3 text-[11px] text-neutral-500">
            More brokers will appear here as they become available.
          </p>
        </div>

        <footer className="flex items-center justify-between border-t border-[#20283a] bg-[#0a0d14] px-5 py-3">
          <button
            type="button"
            onClick={onOpenHistoricalRange}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Historical Range
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Close
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </section>
    </div>
  );
};