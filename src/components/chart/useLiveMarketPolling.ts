import { useEffect } from 'react';
import type { Candle } from '@/types';

interface LiveMarketPollingOptions {
  isLiveMode: boolean;
  currentTimeframe: string;
  updateLiveCandles: (candles: Candle[]) => void;
}

export function useLiveMarketPolling({
  isLiveMode,
  currentTimeframe,
  updateLiveCandles,
}: LiveMarketPollingOptions) {
  useEffect(() => {
    if (!isLiveMode) return;

    let isMounted = true;
    let isRequestInFlight = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let pollingIntervalMs = 2500;
    const pollLive = async () => {
      if (isRequestInFlight) {
        retryTimeout = setTimeout(pollLive, pollingIntervalMs);
        return;
      }
      isRequestInFlight = true;
      try {
        const response = await fetch(`/api/market-data?live=true&timeframe=${currentTimeframe}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) {
          const retryAfterSeconds = Number(response.headers.get('Retry-After'));
          pollingIntervalMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : 15000;
          console.error('Live market data request failed:', data.error || response.statusText);
          return;
        }
        if (isMounted && data.success && Array.isArray(data.candles) && data.candles.length > 0) {
          updateLiveCandles(data.candles);
          pollingIntervalMs = data.provider === 'twelvedata' ? 15000 : 2500;
        }
      } catch (error) {
        pollingIntervalMs = 15000;
        console.error('Unable to poll live market data:', error);
      } finally {
        isRequestInFlight = false;
        if (isMounted) retryTimeout = setTimeout(pollLive, pollingIntervalMs);
      }
    };

    void pollLive();
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isLiveMode, currentTimeframe, updateLiveCandles]);
}
