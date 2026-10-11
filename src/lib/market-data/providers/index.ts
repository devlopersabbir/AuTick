import { MarketDataProvider } from '../types';
import { BybitMarketDataProvider } from './bybit';
import { TwelveDataMarketDataProvider } from './twelvedata';

const providers: Record<string, MarketDataProvider> = {
  bybit: new BybitMarketDataProvider(),
  twelvedata: new TwelveDataMarketDataProvider(),
};

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
