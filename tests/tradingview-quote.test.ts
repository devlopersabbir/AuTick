import { describe, expect, it } from 'bun:test';
import {
  decodeTradingViewMessages,
  encodeTradingViewMessage,
  readOandaGoldQuote,
} from '@/lib/market-data/tradingviewQuote';

describe('TradingView OANDA gold quote protocol', () => {
  it('frames outbound messages using the TradingView message format', () => {
    const message = { m: 'quote_create_session', p: ['qs_test'] };
    const payload = JSON.stringify(message);

    expect(encodeTradingViewMessage(message)).toBe(`~m~${payload.length}~m~${payload}`);
  });

  it('decodes concatenated messages and echoes server heartbeats', () => {
    const heartbeatReplies: string[] = [];
    const first = { m: 'quote_session' };
    const second = { m: 'quote_data' };
    const frame = `~h~123${encodeTradingViewMessage(first)}${encodeTradingViewMessage(second)}`;

    expect(decodeTradingViewMessages(frame, (heartbeat) => heartbeatReplies.push(heartbeat)))
      .toEqual([first, second]);
    expect(heartbeatReplies).toEqual(['~h~123']);
  });

  it('extracts the OANDA XAUUSD last price and daily change', () => {
    expect(readOandaGoldQuote({
      m: 'quote_data',
      p: ['qs_test', [{ n: 'OANDA:XAUUSD', s: 'ok', v: { lp: '2650.25', ch: '4.5', chp: '0.17' } }]],
    })).toEqual({ price: 2650.25, change: 4.5, changePercent: 0.17 });
  });

  it('ignores other symbols and invalid prices', () => {
    expect(readOandaGoldQuote({
      m: 'quote_data',
      p: ['qs_test', [{ n: 'BYBIT:XAUUSDT', s: 'ok', v: { lp: '2650.25' } }]],
    })).toBeNull();
    expect(readOandaGoldQuote({
      m: 'quote_data',
      p: ['qs_test', [{ n: 'OANDA:XAUUSD', s: 'ok', v: { lp: '0' } }]],
    })).toBeNull();
  });
});
