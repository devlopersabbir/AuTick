import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'autick-chart-indicator-settings';

export interface ChartIndicatorSettings {
  breakoutEnabled: boolean;
}

const DEFAULT_SETTINGS: ChartIndicatorSettings = {
  breakoutEnabled: false,
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
          if (
            parsed &&
            typeof parsed === 'object' &&
            'breakoutEnabled' in parsed &&
            typeof parsed.breakoutEnabled === 'boolean'
          ) {
            setSettings({ breakoutEnabled: parsed.breakoutEnabled });
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
  };
}
