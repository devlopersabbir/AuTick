import { NextRequest, NextResponse } from 'next/server';
import {
  getMarketDataProvider,
  getAvailableProviders,
  shouldFallbackToAlternateProvider,
} from '@/lib/market-data/providers';
import { MarketDataApiResponse } from '@/lib/market-data/types';
import { Candle } from '@/types';

async function fetchWithFallback<T>(
  providerParam: string | undefined,
  fetcher: () => Promise<T>,
  fallbackFetcher?: () => Promise<T>
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    const fallbackCandidate = shouldFallbackToAlternateProvider(error, providerParam, !!process.env.TWELVE_DATA_API_KEY);
    if (fallbackCandidate && fallbackFetcher) {
      return await fallbackFetcher();
    }
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<MarketDataApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const providerParam = searchParams.get('provider') || undefined;
    const startTimeParam = searchParams.get('startTime');
    const endTimeParam = searchParams.get('endTime');

    // List providers if requested
    if (searchParams.get('listProviders') === 'true') {
      return NextResponse.json({
        success: true,
        metadata: {
          symbol: 'XAUUSD',
          timeframe: '1m',
          startTime: 0,
          endTime: 0,
          candleCount: 0,
          provider: JSON.stringify(getAvailableProviders()),
        },
      });
    }

    const timeframeParam = searchParams.get('timeframe') || '1m';

    // Real-time live polling for active market
    if (searchParams.get('live') === 'true') {
      const provider = getMarketDataProvider(providerParam);
      let candles: Candle[] = [];
      const fallbackProvider = shouldFallbackToAlternateProvider(new Error('Bybit API HTTP error 403: Forbidden'), providerParam, !!process.env.TWELVE_DATA_API_KEY)
        ? getMarketDataProvider('twelvedata')
        : undefined;

      const fetchLatestCandles = provider.fetchLatestCandles;
      if (fetchLatestCandles) {
        const fallbackLatestMethod = fallbackProvider?.fetchLatestCandles;
        const fallbackLatestFetcher = fallbackLatestMethod
          ? () => fallbackLatestMethod(timeframeParam, 5)
          : undefined;

        candles = await fetchWithFallback(
          providerParam,
          () => fetchLatestCandles(timeframeParam, 5),
          fallbackLatestFetcher
        );
      } else {
        const nowSec = Math.floor(Date.now() / 1000);
        const fetchCandles = provider.fetchCandles;
        const fallbackCandlesFetcher = fallbackProvider
          ? () => fallbackProvider.fetchCandles({
              symbol: 'XAUUSD',
              startTime: nowSec - 300,
              endTime: nowSec,
              timeframe: timeframeParam,
            }).then((result) => result.candles)
          : undefined;

        candles = await fetchWithFallback(
          providerParam,
          () => fetchCandles({
            symbol: 'XAUUSD',
            startTime: nowSec - 300,
            endTime: nowSec,
            timeframe: timeframeParam,
          }).then((result) => result.candles),
          fallbackCandlesFetcher
        );
      }

      return NextResponse.json({
        success: true,
        candles,
      });
    }

    // Dynamic historical backwards pagination (infinite scrollback)
    const olderThanParam = searchParams.get('olderThan');
    if (olderThanParam) {
      const endTimestamp = parseInt(olderThanParam, 10);
      if (isNaN(endTimestamp)) {
        return NextResponse.json(
          { success: false, error: 'Invalid "olderThan" timestamp.' },
          { status: 400 }
        );
      }
      const limit = parseInt(searchParams.get('limit') || '1000', 10);
      const provider = getMarketDataProvider(providerParam);
      let candles: Candle[] = [];
      const fallbackProvider = shouldFallbackToAlternateProvider(new Error('Bybit API HTTP error 403: Forbidden'), providerParam, !!process.env.TWELVE_DATA_API_KEY)
        ? getMarketDataProvider('twelvedata')
        : undefined;

      const fetchOlderCandles = provider.fetchOlderCandles;
      if (fetchOlderCandles) {
        const fallbackOlderMethod = fallbackProvider?.fetchOlderCandles;
        const fallbackOlderFetcher = fallbackOlderMethod
          ? () => fallbackOlderMethod(endTimestamp, timeframeParam, limit)
          : undefined;

        candles = await fetchWithFallback(
          providerParam,
          () => fetchOlderCandles(endTimestamp, timeframeParam, limit),
          fallbackOlderFetcher
        );
      }
      return NextResponse.json({
        success: true,
        candles,
      });
    }

    if (!startTimeParam || !endTimeParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameters: "startTime" and "endTime" (Unix timestamps in seconds) are required.',
        },
        { status: 400 }
      );
    }

    const startTime = parseInt(startTimeParam, 10);
    const endTime = parseInt(endTimeParam, 10);

    if (isNaN(startTime) || isNaN(endTime)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid "startTime" or "endTime" parameter. Must be valid integer timestamps.',
        },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date range: startTime must be strictly before endTime.',
        },
        { status: 400 }
      );
    }

    const provider = getMarketDataProvider(providerParam);
    const fallbackProvider = shouldFallbackToAlternateProvider(new Error('Bybit API HTTP error 403: Forbidden'), providerParam, !!process.env.TWELVE_DATA_API_KEY)
      ? getMarketDataProvider('twelvedata')
      : undefined;
    const fallbackCandlesFetcher = fallbackProvider
      ? () => fallbackProvider.fetchCandles({
          symbol: 'XAUUSD',
          startTime,
          endTime,
          timeframe: timeframeParam,
        })
      : undefined;

    const result = await fetchWithFallback(
      providerParam,
      () => provider.fetchCandles({
        symbol: 'XAUUSD',
        startTime,
        endTime,
        timeframe: timeframeParam,
      }),
      fallbackCandlesFetcher
    );

    return NextResponse.json({
      success: true,
      candles: result.candles,
      metadata: result.metadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
