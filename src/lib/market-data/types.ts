import { Candle, DatasetMetadata, FetchCandlesParams } from '@/types';

export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  fetchCandles(params: FetchCandlesParams): Promise<{
    candles: Candle[];
    metadata: DatasetMetadata;
  }>;
}

export interface MarketDataApiResponse {
  success: boolean;
  candles?: Candle[];
  metadata?: DatasetMetadata;
  error?: string;
}
