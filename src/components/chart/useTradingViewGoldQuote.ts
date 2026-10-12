import { useEffect, useState } from 'react';
import type {
  TradingViewGoldQuote,
} from '@/lib/market-data/tradingviewQuote';
import type {
  TradingViewGoldQuoteStatus,
} from '@/lib/market-data/tradingviewQuoteFeed';

interface QuoteApiResponse {
  success: boolean;
  quote: TradingViewGoldQuote | null;
  status: TradingViewGoldQuoteStatus;
}

interface TradingViewQuoteState {
  quote: TradingViewGoldQuote | null;
  status: TradingViewGoldQuoteStatus;
}

export function useTradingViewGoldQuote() {
  const [state, setState] = useState<TradingViewQuoteState>({
    quote: null,
    status: 'connecting',
  });

  useEffect(() => {
    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch('/api/market-data/quote', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Quote API returned HTTP ${response.status}`);
        }

        const result: QuoteApiResponse = await response.json();
        if (!result.success) {
          throw new Error('Quote API returned an unsuccessful response');
        }

        if (isMounted) setState({ quote: result.quote, status: result.status });
      } catch {
        if (isMounted) {
          setState((current) => ({ ...current, status: 'reconnecting' }));
        }
      } finally {
        if (isMounted) pollTimeout = setTimeout(poll, 1000);
      }
    };

    void poll();
    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, []);

  return state;
}
