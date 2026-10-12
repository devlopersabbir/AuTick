'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { BreakoutIndicatorConfig } from '@/lib/market-data/breakout-indicator';
import type { FairValueGapConfig } from '@/lib/market-data/fair-value-gap';
import { ChartSettingsModal } from './ChartSettingsModal';

interface ChartIndicatorSettingsProps {
  breakoutEnabled: boolean;
  breakoutConfig: BreakoutIndicatorConfig;
  fairValueGapEnabled: boolean;
  fairValueGapConfig: FairValueGapConfig;
  onToggleBreakout: (enabled: boolean) => void;
  onUpdateBreakoutConfig: (updates: Partial<BreakoutIndicatorConfig>) => void;
  onToggleFairValueGap: (enabled: boolean) => void;
  onUpdateFairValueGapConfig: (updates: Partial<FairValueGapConfig>) => void;
}

export function ChartIndicatorSettings({
  breakoutEnabled,
  breakoutConfig,
  fairValueGapEnabled,
  fairValueGapConfig,
  onToggleBreakout,
  onUpdateBreakoutConfig,
  onToggleFairValueGap,
  onUpdateFairValueGapConfig,
}: ChartIndicatorSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Chart settings"
        aria-label="Open chart settings"
        className="absolute right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-[#303844] bg-[#0d111a]/90 text-neutral-400 shadow-lg backdrop-blur-md transition-colors hover:border-amber-400/60 hover:text-amber-300"
      >
        <Settings2 className="h-4 w-4" />
        {(breakoutEnabled || fairValueGapEnabled) && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />
        )}
      </button>
      <ChartSettingsModal
        isOpen={isOpen}
        breakoutEnabled={breakoutEnabled}
        breakoutConfig={breakoutConfig}
        fairValueGapEnabled={fairValueGapEnabled}
        fairValueGapConfig={fairValueGapConfig}
        onToggleBreakout={onToggleBreakout}
        onUpdateBreakoutConfig={onUpdateBreakoutConfig}
        onToggleFairValueGap={onToggleFairValueGap}
        onUpdateFairValueGapConfig={onUpdateFairValueGapConfig}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
