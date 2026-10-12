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
      try {
        return await fallbackFetcher();
      } catch (fallbackError) {
        const primaryMessage = error instanceof Error ? error.message : String(error);
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(
          `Primary provider failed: ${primaryMessage}. Alternate provider also failed: ${fallbackMessage}`,
          { cause: error },
        );
      }
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
      const fallbackProvider = shouldFallbackToAlternateProvider(new Error('Bybit API HTTP error 403: Forbidden'), providerParam, !!process.env.TWELVE_DATA_API_KEY)
        ? getMarketDataProvider('twelvedata')
        : undefined;
      const nowSec = Math.floor(Date.now() / 1000);
      const timeframeSeconds: Record<string, number> = {
        '1m': 60,
        '3m': 180,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '2h': 7200,
        '4h': 14400,
        '1d': 86400,
      };
      const windowSeconds = Math.max(300, (timeframeSeconds[timeframeParam.toLowerCase()] || 60) * 5);
      const startTime = nowSec - windowSeconds;
      const latestMethod = provider.fetchLatestCandles?.bind(provider);
      const fallbackLatestMethod = fallbackProvider?.fetchLatestCandles?.bind(fallbackProvider);
      const fetchLatest = latestMethod
        ? () => latestMethod(timeframeParam, 5)
        : () => provider.fetchCandles({
            symbol: 'XAUUSD',
            startTime,
            endTime: nowSec,
            timeframe: timeframeParam,
          }).then((result) => result.candles);
      const fetchFallbackLatest = fallbackProvider
        ? fallbackLatestMethod
          ? () => fallbackLatestMethod(timeframeParam, 5)
          : () => fallbackProvider.fetchCandles({
              symbol: 'XAUUSD',
              startTime,
              endTime: nowSec,
              timeframe: timeframeParam,
            }).then((result) => result.candles)
        : undefined;
      let activeProviderId = provider.id;
      const candles = await fetchWithFallback(
        providerParam,
        fetchLatest,
        fallbackProvider && fetchFallbackLatest
          ? async () => {
              activeProviderId = fallbackProvider.id;
              return fetchFallbackLatest();
            }
          : undefined,
      );

      return NextResponse.json({
        success: true,
        candles,
        provider: activeProviderId,
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

      const fetchOlderCandles = provider.fetchOlderCandles?.bind(provider);
      if (fetchOlderCandles) {
        const fallbackOlderMethod = fallbackProvider?.fetchOlderCandles?.bind(fallbackProvider);
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
    const isRateLimited = /HTTP error 429|Too Many Requests/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: isRateLimited ? 429 : 500,
        headers: isRateLimited ? { 'Retry-After': '60' } : undefined,
      }
    );
  }
}
