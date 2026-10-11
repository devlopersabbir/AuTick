import { MarketDataProvider } from '../types';
import { BybitMarketDataProvider } from './bybit';
import { TwelveDataMarketDataProvider } from './twelvedata';

const providers: Record<string, MarketDataProvider> = {
  bybit: new BybitMarketDataProvider(),
  twelvedata: new TwelveDataMarketDataProvider(),
};

export function shouldFallbackToAlternateProvider(error: unknown, providerId?: string, hasAlternateKey: boolean = !!process.env.TWELVE_DATA_API_KEY): boolean {
  const requestedProvider = (providerId || process.env.DEFAULT_DATA_PROVIDER || 'bybit').toLowerCase();
  const message = error instanceof Error ? error.message : String(error ?? '');

  return requestedProvider === 'bybit' && hasAlternateKey && /Bybit API HTTP error 403|Bybit API returned error code.*403|Forbidden/i.test(message);
}

export function getMarketDataProvider(providerId?: string): MarketDataProvider {
  const defaultId = process.env.DEFAULT_DATA_PROVIDER || 'bybit';
  const id = providerId || defaultId;
  const provider = providers[id.toLowerCase()];

  if (!provider) {
    throw new Error(`Unsupported market data provider: "${id}". Supported providers: ${Object.keys(providers).join(', ')}`);
  }

  return provider;
}

export function getAvailableProviders(): Array<{ id: string; name: string }> {
  return Object.values(providers).map((p) => ({ id: p.id, name: p.name }));
}
