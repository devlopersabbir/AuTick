'use client';

import { useEffect } from 'react';
import { Activity, X } from 'lucide-react';
import type { BreakoutIndicatorConfig } from '@/lib/market-data/breakout-indicator';
import type { FairValueGapConfig } from '@/lib/market-data/fair-value-gap';

interface ChartSettingsModalProps {
  isOpen: boolean;
  breakoutEnabled: boolean;
  breakoutConfig: BreakoutIndicatorConfig;
  fairValueGapEnabled: boolean;
  fairValueGapConfig: FairValueGapConfig;
  onToggleBreakout: (enabled: boolean) => void;
  onUpdateBreakoutConfig: (updates: Partial<BreakoutIndicatorConfig>) => void;
  onToggleFairValueGap: (enabled: boolean) => void;
  onUpdateFairValueGapConfig: (updates: Partial<FairValueGapConfig>) => void;
  onClose: () => void;
}

export function ChartSettingsModal({
  isOpen,
  breakoutEnabled,
  breakoutConfig,
  fairValueGapEnabled,
  fairValueGapConfig,
  onToggleBreakout,
  onUpdateBreakoutConfig,
  onToggleFairValueGap,
  onUpdateFairValueGapConfig,
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
        className="max-h-[min(80vh,720px)] w-full max-w-md overflow-y-auto rounded-lg border border-[#303844] bg-[#10151e] p-4 shadow-2xl"
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
                A closed candle breaking the prior range is scored with ATR-normalized strength,
                close location, EMA trend and slope, momentum, and a directional wick penalty.
                Markers are calculated chronologically in live mode and replay.
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

        <fieldset disabled={!breakoutEnabled} className="mt-4 space-y-4 disabled:opacity-50">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Calculation
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <NumberSetting
              label="Range lookback"
              value={breakoutConfig.lookbackPeriod}
              min={2}
              max={300}
              onChange={(value) => onUpdateBreakoutConfig({ lookbackPeriod: value })}
            />
            <NumberSetting
              label="ATR period"
              value={breakoutConfig.atrPeriod}
              min={2}
              max={200}
              onChange={(value) => onUpdateBreakoutConfig({ atrPeriod: value })}
            />
            <NumberSetting
              label="Fast EMA"
              value={breakoutConfig.fastEmaPeriod}
              min={2}
              max={200}
              onChange={(value) => onUpdateBreakoutConfig({ fastEmaPeriod: value })}
            />
            <NumberSetting
              label="Slow EMA"
              value={breakoutConfig.slowEmaPeriod}
              min={3}
              max={500}
              onChange={(value) => onUpdateBreakoutConfig({ slowEmaPeriod: value })}
            />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Score weights</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting
                label="Breakout strength"
                value={breakoutConfig.breakoutStrengthWeight}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ breakoutStrengthWeight: value })}
              />
              <NumberSetting
                label="Candle quality"
                value={breakoutConfig.candleQualityWeight}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ candleQualityWeight: value })}
              />
              <NumberSetting
                label="Trend"
                value={breakoutConfig.trendWeight}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ trendWeight: value })}
              />
              <NumberSetting
                label="Momentum"
                value={breakoutConfig.momentumWeight}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ momentumWeight: value })}
              />
              <NumberSetting
                label="Wick penalty"
                value={breakoutConfig.wickPenaltyWeight}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ wickPenaltyWeight: value })}
              />
              <NumberSetting
                label="Breakout threshold (ATR)"
                value={breakoutConfig.breakoutThreshold}
                min={0}
                max={5}
                step={0.05}
                onChange={(value) => onUpdateBreakoutConfig({ breakoutThreshold: value })}
              />
              <NumberSetting
                label="Min probability (%)"
                value={Math.round(breakoutConfig.probabilityThreshold * 100)}
                min={50}
                max={99}
                step={1}
                onChange={(value) => onUpdateBreakoutConfig({ probabilityThreshold: value / 100 })}
              />
            </div>
          </div>
        </fieldset>

        <details className="mt-3 rounded border border-[#252d3a] bg-[#0c1017] px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-medium text-neutral-300">
            Scoring equations
          </summary>
          <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-neutral-400">
            <p>Strength = directional close beyond prior rolling high/low ÷ ATR.</p>
            <p>Close quality = (close − low) ÷ (high − low); bearish quality is its inverse.</p>
            <p>Trend = (fast EMA − slow EMA + fast EMA slope) ÷ ATR. Momentum = (close − fast EMA) ÷ ATR.</p>
            <p>Directional score = weighted strength + quality + trend + momentum − weighted opposing wick.</p>
            <p>Probability estimate = 1 ÷ (1 + exp(−score)); it is not calibrated to realized outcomes.</p>
          </div>
        </details>

        <div className="mt-4 rounded-md border border-[#252d3a] bg-[#141a24] p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-300">
              <Activity className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-neutral-100">Fair Value Gaps</span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">
                Three-candle gaps are confirmed after the third candle closes. Zone status follows
                closed candles only. A zone is drawn only when a breakout signal confirms in the
                same direction on that third candle.
              </span>
            </span>
            <input
              type="checkbox"
              checked={fairValueGapEnabled}
              onChange={(event) => onToggleFairValueGap(event.target.checked)}
              aria-label="Enable Fair Value Gaps"
              className="mt-1 h-4 w-4 accent-emerald-400"
            />
          </label>
        </div>

        <fieldset disabled={!fairValueGapEnabled} className="mt-4 space-y-3 disabled:opacity-50">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            FVG zones
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <NumberSetting
              label="Extend (candles)"
              value={fairValueGapConfig.extensionCandles}
              min={1}
              max={1000}
              onChange={(value) => onUpdateFairValueGapConfig({ extensionCandles: value })}
            />
            <NumberSetting
              label="Minimum gap (ATR)"
              value={fairValueGapConfig.minGapAtrMultiplier}
              min={0}
              max={10}
              step={0.05}
              onChange={(value) => onUpdateFairValueGapConfig({ minGapAtrMultiplier: value })}
            />
          </div>
          <SettingCheckbox
            label="Filter gaps by minimum ATR size"
            checked={fairValueGapConfig.minGapFilterEnabled}
            onChange={(enabled) => onUpdateFairValueGapConfig({ minGapFilterEnabled: enabled })}
          />
          <SettingCheckbox
            label="Expire zones"
            checked={fairValueGapConfig.expiryEnabled}
            onChange={(enabled) => onUpdateFairValueGapConfig({ expiryEnabled: enabled })}
          />
          <SettingCheckbox
            label="Invalidate on close beyond far boundary"
            checked={fairValueGapConfig.invalidationEnabled}
            onChange={(enabled) => onUpdateFairValueGapConfig({ invalidationEnabled: enabled })}
          />
          {fairValueGapConfig.expiryEnabled && (
            <NumberSetting
              label="Expire after (candles)"
              value={fairValueGapConfig.expiryCandles}
              min={1}
              max={10000}
              onChange={(value) => onUpdateFairValueGapConfig({ expiryCandles: value })}
            />
          )}
          <SettingCheckbox
            label="Keep fully filled zones visible"
            checked={fairValueGapConfig.showFilledZones}
            onChange={(enabled) => onUpdateFairValueGapConfig({ showFilledZones: enabled })}
          />
        </fieldset>

        <details className="mt-3 rounded border border-[#252d3a] bg-[#0c1017] px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-medium text-neutral-300">
            FVG equations and lifecycle
          </summary>
          <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-neutral-400">
            <p>Bullish: low[t] &gt; high[t−2]; zone = [high[t−2], low[t]].</p>
            <p>Bearish: high[t] &lt; low[t−2]; zone = [high[t], low[t−2]].</p>
            <p>Touch is first entry; partial fill is penetration; full fill traverses the far boundary.</p>
            <p>When enabled, invalidation is a confirmed close beyond the far boundary. Expiry is candle-age based.</p>
          </div>
        </details>

        <p className="mt-3 text-[11px] text-neutral-500">
          Score: weighted features → logistic probability. This is an uncalibrated estimate, not a forecast.
          Settings are saved in this browser.
        </p>
      </section>
    </div>
  );
}

interface SettingCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingCheckbox({ label, checked, onChange }: SettingCheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-emerald-400"
      />
      {label}
    </label>
  );
}

interface NumberSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberSetting({ label, value, min, max, step = 1, onChange }: NumberSettingProps) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px] text-neutral-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue)) onChange(nextValue);
        }}
        className="h-8 w-full rounded border border-[#303844] bg-[#0c1017] px-2 font-mono text-xs text-neutral-100 outline-none focus:border-amber-400"
      />
    </label>
  );
}
