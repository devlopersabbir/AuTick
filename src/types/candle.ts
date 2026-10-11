export interface Candle {
  /** UTC epoch timestamp in seconds */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface DatasetMetadata {
  symbol: string;
  timeframe: string;
  startTime: number; // UTC seconds
  endTime: number;   // UTC seconds
  candleCount: number;
  provider: string;
}

export interface FetchCandlesParams {
  symbol: string;
  startTime: number; // UTC seconds
  endTime: number;   // UTC seconds
  timeframe?: string; // '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D'
  limit?: number;
}
