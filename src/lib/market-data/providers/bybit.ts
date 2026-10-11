import { Candle, DatasetMetadata, FetchCandlesParams } from '@/types';
import { MarketDataProvider } from '../types';
import { validateAndSortCandles } from '../validation';

interface BybitKlineResponse {
  retCode: number;
  retMsg: string;
  result?: {
    symbol: string;
    category: string;
    list: Array<[string, string, string, string, string, string, string]>;
  };
}

export class BybitMarketDataProvider implements MarketDataProvider {
  readonly id = 'bybit';
  readonly name = 'Bybit (Linear Perpetual)';

  private baseUrl = 'https://api.bybit.com/v5/market/kline';

  async fetchCandles(params: FetchCandlesParams): Promise<{
    candles: Candle[];
    metadata: DatasetMetadata;
  }> {
    const { startTime, endTime } = params;

    if (startTime >= endTime) {
      throw new Error(`Invalid date range: startTime (${startTime}) must be before endTime (${endTime})`);
    }

    const startMs = startTime * 1000;
    const endMs = endTime * 1000;

    const rawCandleList: Candle[] = [];
    let currentEndMs = endMs;
    const maxPages = 10; // Up to 10,000 1-minute candles (~7 days)
    let page = 0;

    while (currentEndMs > startMs && page < maxPages) {
      page++;
      const url = new URL(this.baseUrl);
      url.searchParams.set('category', 'linear');
      url.searchParams.set('symbol', 'XAUUSDT');
      url.searchParams.set('interval', '1');
      url.searchParams.set('start', startMs.toString());
      url.searchParams.set('end', currentEndMs.toString());
      url.searchParams.set('limit', '1000');

      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AuTick-MarketReplay/1.0',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Bybit API HTTP error ${response.status}: ${response.statusText}`);
      }

      const json: BybitKlineResponse = await response.json();

      if (json.retCode !== 0) {
        throw new Error(`Bybit API returned error code ${json.retCode}: ${json.retMsg}`);
      }

      const list = json.result?.list;
      if (!list || list.length === 0) {
        break;
      }

      for (const item of list) {
        // [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
        const candleStartMs = parseInt(item[0], 10);
        const candle: Candle = {
          timestamp: Math.floor(candleStartMs / 1000),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        };
        rawCandleList.push(candle);
      }

      // Oldest candle in this batch (since Bybit returns newest first)
      const oldestBatchMs = parseInt(list[list.length - 1][0], 10);

      // If we got fewer than 1000 candles or reached the beginning, stop
      if (list.length < 1000 || oldestBatchMs <= startMs) {
        break;
      }

      // Next page ends 1 minute before the oldest received candle
      currentEndMs = oldestBatchMs - 1;
    }

    if (rawCandleList.length === 0) {
      throw new Error(`No historical candles found for XAUUSD between UTC ${new Date(startMs).toISOString()} and ${new Date(endMs).toISOString()}`);
    }

    const validatedCandles = validateAndSortCandles(rawCandleList);

    if (validatedCandles.length === 0) {
      throw new Error('All retrieved candles failed validation checks.');
    }

    const metadata: DatasetMetadata = {
      symbol: 'XAUUSD',
      timeframe: '1m',
      startTime: validatedCandles[0].timestamp,
      endTime: validatedCandles[validatedCandles.length - 1].timestamp,
      candleCount: validatedCandles.length,
      provider: this.name,
    };

    return {
      candles: validatedCandles,
      metadata,
    };
  }
}
