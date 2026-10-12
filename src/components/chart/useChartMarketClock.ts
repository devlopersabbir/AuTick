import { useEffect, useState } from 'react';
import type { Candle } from '@/types';
import { TIMEFRAME_SECONDS, formatCountdown } from './chartConstants';
import { getNextMarketSessionBoundary, getSessionInfo } from '@/lib/utils/sessions';

interface ChartMarketClockOptions {
  currentCandle: Candle | null;
  currentTimeframe: string;
  isLiveMode: boolean;
}

export function useChartMarketClock({
  currentCandle,
  currentTimeframe,
  isLiveMode,
}: ChartMarketClockOptions) {
  const [clockNow, setClockNow] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => setClockNow(Date.now()), 0);
    const intervalId = setInterval(() => setClockNow(Date.now()), 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  const currentMarketSession = clockNow === null
    ? null
    : getSessionInfo(Math.floor(clockNow / 1000));
  const sessionBoundary = clockNow === null
    ? null
    : getNextMarketSessionBoundary(new Date(clockNow));
  const sessionSecondsRemaining = sessionBoundary === null
    ? null
    : Math.max(0, Math.ceil((sessionBoundary.timestamp - (clockNow ?? 0)) / 1000));
  const sessionCountdown = sessionSecondsRemaining === null
    ? null
    : formatCountdown(sessionSecondsRemaining, true);
  const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
  const nextCandleClose = clockNow === null
    ? null
    : (Math.floor(clockNow / (timeframeSeconds * 1000)) + 1) * timeframeSeconds * 1000;
  const candleSecondsRemaining = clockNow === null || nextCandleClose === null || !isLiveMode ||
    !currentCandle || !currentMarketSession?.isMarketOpen
    ? null
    : Math.max(0, Math.ceil((nextCandleClose - clockNow) / 1000));

  return {
    sessionCountdown,
    sessionAction: sessionBoundary?.action ?? null,
    candleCountdown: candleSecondsRemaining === null
      ? null
      : formatCountdown(candleSecondsRemaining),
    isMarketOpen: currentMarketSession?.isMarketOpen ?? false,
  };
}
