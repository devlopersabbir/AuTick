import { Candle, DatasetMetadata, FetchCandlesParams } from '@/types';
import { MarketDataProvider } from '../types';
import { validateAndSortCandles } from '../validation';

interface TwelveDataTimeSeriesResponse {
  meta?: {
    symbol: string;
    interval: string;
  };
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status?: string;
  message?: string;
  code?: number;
}

export class TwelveDataMarketDataProvider implements MarketDataProvider {
  readonly id = 'twelvedata';
  readonly name = 'Twelve Data (XAU/USD)';

  private baseUrl = 'https://api.twelvedata.com/time_series';

  async fetchCandles(params: FetchCandlesParams): Promise<{
    candles: Candle[];
    metadata: DatasetMetadata;
  }> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('Twelve Data requires TWELVE_DATA_API_KEY to be configured in your server environment (.env.local).');
    }

    const { startTime, endTime } = params;
    if (startTime >= endTime) {
      throw new Error(`Invalid date range: startTime (${startTime}) must be before endTime (${endTime})`);
    }

    const formatUtc = (secs: number) => {
      const d = new Date(secs * 1000);
      return d.toISOString().replace('T', ' ').substring(0, 19);
    };

    const url = new URL(this.baseUrl);
    url.searchParams.set('symbol', 'XAU/USD');
    url.searchParams.set('interval', '1min');
    url.searchParams.set('start_date', formatUtc(startTime));
    url.searchParams.set('end_date', formatUtc(endTime));
    url.searchParams.set('outputsize', '5000');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AuTick-MarketReplay/1.0' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Twelve Data API HTTP error ${response.status}: ${response.statusText}`);
    }

    const json: TwelveDataTimeSeriesResponse = await response.json();

    if (json.status === 'error' || json.code) {
      throw new Error(`Twelve Data API error: ${json.message || 'Unknown error'}`);
    }

    if (!json.values || json.values.length === 0) {
      throw new Error(`No historical candles found in Twelve Data for the selected range.`);
    }

    const rawCandles: Candle[] = json.values.map((v) => {
      const timestamp = Math.floor(new Date(v.datetime + 'Z').getTime() / 1000);
      return {
        timestamp,
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseFloat(v.volume) : undefined,
      };
    });

    const validatedCandles = validateAndSortCandles(rawCandles);
    if (validatedCandles.length === 0) {
      throw new Error('All candles received from Twelve Data failed validation checks.');
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
