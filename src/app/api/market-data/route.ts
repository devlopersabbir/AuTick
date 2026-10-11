import { NextRequest, NextResponse } from 'next/server';
import { getMarketDataProvider, getAvailableProviders } from '@/lib/market-data/providers';
import { MarketDataApiResponse } from '@/lib/market-data/types';
import { Candle } from '@/types';


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
      if (provider.fetchLatestCandles) {
        candles = await provider.fetchLatestCandles(timeframeParam, 5);
      } else {
        const nowSec = Math.floor(Date.now() / 1000);
        const result = await provider.fetchCandles({
          symbol: 'XAUUSD',
          startTime: nowSec - 300,
          endTime: nowSec,
          timeframe: timeframeParam,
        });
        candles = result.candles;
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
      if (provider.fetchOlderCandles) {
        candles = await provider.fetchOlderCandles(endTimestamp, timeframeParam, limit);
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
    const result = await provider.fetchCandles({
      symbol: 'XAUUSD',
      startTime,
      endTime,
      timeframe: timeframeParam,
    });

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
