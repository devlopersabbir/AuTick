import WebSocket from 'ws';
import {
  decodeTradingViewMessages,
  encodeTradingViewMessage,
  readOandaGoldQuote,
  type TradingViewGoldQuote,
} from './tradingviewQuote';

export type TradingViewGoldQuoteStatus = 'connecting' | 'live' | 'snapshot' | 'reconnecting';

export interface TradingViewGoldQuoteSnapshot {
  quote: TradingViewGoldQuote | null;
  status: TradingViewGoldQuoteStatus;
}

interface ScannerResponse {
  totalCount?: number;
  data?: Array<{ s?: string; d?: unknown[] }>;
}

class TradingViewQuoteFeed {
  private socket: WebSocket | null = null;
  private snapshot: TradingViewGoldQuoteSnapshot = { quote: null, status: 'connecting' };
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;
  private fallbackRequestedAt = 0;
  private fallbackInFlight = false;
  private lastWebSocketUpdateAt = 0;

  getSnapshot(): TradingViewGoldQuoteSnapshot {
    this.connect();
    void this.refreshScannerSnapshot();
    return this.snapshot;
  }

  private connect() {
    if (this.socket || this.reconnectTimeout) return;

    this.snapshot = { ...this.snapshot, status: this.snapshot.quote ? 'reconnecting' : 'connecting' };
    const quoteSession = `qs_${crypto.randomUUID().replaceAll('-', '')}`;
    const now = new Date();
    const date = `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}_${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}_${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const url = `wss://data.tradingview.com/socket.io/websocket?from=chart%2F${crypto.randomUUID()}&date=${date}&type=chart`;
    const socket = new WebSocket(url, {
      headers: { Origin: 'https://www.tradingview.com' },
    });
    this.socket = socket;

    socket.on('open', () => {
      const send = (method: string, params: unknown[]) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(encodeTradingViewMessage({ m: method, p: params }));
      };

      send('set_auth_token', ['unauthorized_user_token']);
      send('quote_create_session', [quoteSession]);
      send('quote_set_fields', [
        quoteSession,
        'lp',
        'ch',
        'chp',
        'bid',
        'ask',
        'short_name',
        'exchange',
        'description',
      ]);
      send('quote_add_symbols', [quoteSession, 'OANDA:XAUUSD']);

      this.connectionTimeout = setTimeout(() => socket.close(), 10000);
    });

    socket.on('message', (data) => {
      const frame = data.toString();
      const messages = decodeTradingViewMessages(frame, (heartbeat) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(heartbeat);
      });

      for (const message of messages) {
        const quote = this.readQuoteMessage(message, quoteSession);
        if (!quote) continue;
        this.lastWebSocketUpdateAt = Date.now();
        this.retryDelay = 1000;
        this.clearConnectionTimeout();
        this.snapshot = { quote, status: 'live' };
      }
    });

    socket.on('error', () => {
      this.snapshot = { ...this.snapshot, status: 'reconnecting' };
      socket.terminate();
    });

    socket.on('close', () => {
      this.clearConnectionTimeout();
      if (this.socket === socket) this.socket = null;
      this.snapshot = { ...this.snapshot, status: 'reconnecting' };
      this.scheduleReconnect();
    });
  }

  private readQuoteMessage(message: unknown, quoteSession: string): TradingViewGoldQuote | null {
    if (
      message &&
      typeof message === 'object' &&
      'm' in message &&
      message.m === 'qsd' &&
      'p' in message &&
      Array.isArray(message.p)
    ) {
      const data = message.p[1];
      return readOandaGoldQuote({
        m: 'quote_data',
        p: [quoteSession, Array.isArray(data) ? data : data ? [data] : []],
      });
    }

    return readOandaGoldQuote(message);
  }

  private async refreshScannerSnapshot() {
    const now = Date.now();
    if (this.fallbackInFlight || now - this.fallbackRequestedAt < 10000) return;
    if (now - this.lastWebSocketUpdateAt < 10000) return;

    this.fallbackRequestedAt = now;
    this.fallbackInFlight = true;
    try {
      const response = await fetch('https://scanner.tradingview.com/cfd/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: { tickers: ['OANDA:XAUUSD'], query: { types: [] } },
          columns: ['close', 'change', 'change_abs'],
        }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`TradingView scanner returned HTTP ${response.status}`);
      }

      const result: ScannerResponse = await response.json();
      const row = result.data?.find((item) => item.s === 'OANDA:XAUUSD');
      const [priceValue, changeRatioValue, changeValue] = row?.d ?? [];
      const price = Number(priceValue);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('TradingView scanner did not return a valid OANDA:XAUUSD price');
      }

      const changeRatio = Number(changeRatioValue);
      const change = Number(changeValue);
      const quote: TradingViewGoldQuote = {
        price,
        change: Number.isFinite(change) ? change : null,
        changePercent: Number.isFinite(changeRatio) ? changeRatio * 100 : null,
      };

      if (Date.now() - this.lastWebSocketUpdateAt >= 10000) {
        this.snapshot = { quote, status: 'snapshot' };
      }
    } catch (error) {
      console.error(
        'Unable to refresh TradingView OANDA:XAUUSD snapshot:',
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.fallbackInFlight = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    this.connectionTimeout = null;
  }
}

const feed = new TradingViewQuoteFeed();

export function getTradingViewGoldQuoteSnapshot(): TradingViewGoldQuoteSnapshot {
  return feed.getSnapshot();
}
