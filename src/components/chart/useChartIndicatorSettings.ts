import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_BREAKOUT_INDICATOR_CONFIG,
  normalizeBreakoutIndicatorConfig,
  type BreakoutIndicatorConfig,
} from '@/lib/market-data/breakout-indicator';
import {
  DEFAULT_FAIR_VALUE_GAP_CONFIG,
  normalizeFairValueGapConfig,
  type FairValueGapConfig,
} from '@/lib/market-data/fair-value-gap';

const STORAGE_KEY = 'autick-chart-indicator-settings';

export interface ChartIndicatorSettings {
  breakoutEnabled: boolean;
  breakout: BreakoutIndicatorConfig;
  fairValueGapEnabled: boolean;
  fairValueGap: FairValueGapConfig;
}

const DEFAULT_SETTINGS: ChartIndicatorSettings = {
  breakoutEnabled: false,
  breakout: DEFAULT_BREAKOUT_INDICATOR_CONFIG,
  fairValueGapEnabled: true,
  fairValueGap: DEFAULT_FAIR_VALUE_GAP_CONFIG,
};

export function useChartIndicatorSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const loadedRef = useRef(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const storedValue = localStorage.getItem(STORAGE_KEY);
        if (storedValue) {
          const parsed: unknown = JSON.parse(storedValue);
          if (parsed && typeof parsed === 'object') {
            const settingsRecord = parsed as Record<string, unknown>;
            setSettings({
              breakoutEnabled: typeof settingsRecord.breakoutEnabled === 'boolean'
                ? settingsRecord.breakoutEnabled
                : DEFAULT_SETTINGS.breakoutEnabled,
              breakout: settingsRecord.breakout && typeof settingsRecord.breakout === 'object'
                ? normalizeBreakoutIndicatorConfig(settingsRecord.breakout as Partial<BreakoutIndicatorConfig>)
                : DEFAULT_BREAKOUT_INDICATOR_CONFIG,
              fairValueGapEnabled: typeof settingsRecord.fairValueGapEnabled === 'boolean'
                ? settingsRecord.fairValueGapEnabled
                : DEFAULT_SETTINGS.fairValueGapEnabled,
              fairValueGap: settingsRecord.fairValueGap && typeof settingsRecord.fairValueGap === 'object'
                ? normalizeFairValueGapConfig(settingsRecord.fairValueGap as Partial<FairValueGapConfig>)
                : DEFAULT_FAIR_VALUE_GAP_CONFIG,
            });
          }
        }
      } catch (error) {
        console.error('Unable to load chart indicator settings:', error);
      } finally {
        loadedRef.current = true;
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Unable to save chart indicator settings:', error);
    }
  }, [settings]);

  return {
    settings,
    setBreakoutEnabled: (enabled: boolean) => {
      setSettings((current) => ({ ...current, breakoutEnabled: enabled }));
    },
    updateBreakoutConfig: (updates: Partial<BreakoutIndicatorConfig>) => {
      setSettings((current) => ({
        ...current,
        breakout: normalizeBreakoutIndicatorConfig({ ...current.breakout, ...updates }),
      }));
    },
    setFairValueGapEnabled: (enabled: boolean) => {
      setSettings((current) => ({ ...current, fairValueGapEnabled: enabled }));
    },
    updateFairValueGapConfig: (updates: Partial<FairValueGapConfig>) => {
      setSettings((current) => ({
        ...current,
        fairValueGap: normalizeFairValueGapConfig({ ...current.fairValueGap, ...updates }),
      }));
    },
  };
}
