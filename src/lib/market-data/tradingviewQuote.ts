export interface TradingViewGoldQuote {
  price: number;
  change: number | null;
  changePercent: number | null;
}

export function encodeTradingViewMessage(message: unknown): string {
  const payload = JSON.stringify(message);
  return `~m~${payload.length}~m~${payload}`;
}

export function decodeTradingViewMessages(
  frame: string,
  onHeartbeat?: (heartbeat: string) => void,
): unknown[] {
  const messages: unknown[] = [];
  let remaining = frame;

  while (remaining.length > 0) {
    if (remaining.startsWith('~h~')) {
      const nextMessage = remaining.indexOf('~m~', 3);
      const heartbeat = nextMessage === -1 ? remaining : remaining.slice(0, nextMessage);
      onHeartbeat?.(heartbeat);
      if (nextMessage === -1) break;
      remaining = remaining.slice(nextMessage);
      continue;
    }

    if (!remaining.startsWith('~m~')) break;
    const lengthEnd = remaining.indexOf('~m~', 3);
    if (lengthEnd === -1) break;

    const payloadLength = Number(remaining.slice(3, lengthEnd));
    if (!Number.isInteger(payloadLength) || payloadLength < 0) break;

    const payloadStart = lengthEnd + 3;
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > remaining.length) break;

    try {
      messages.push(JSON.parse(remaining.slice(payloadStart, payloadEnd)));
    } catch {
      // Ignore non-JSON TradingView protocol frames.
    }
    remaining = remaining.slice(payloadEnd);
  }

  return messages;
}

export function readOandaGoldQuote(message: unknown): TradingViewGoldQuote | null {
  if (!message || typeof message !== 'object' || !('m' in message) || message.m !== 'quote_data') {
    return null;
  }

  const params = 'p' in message && Array.isArray(message.p) ? message.p : [];
  const quoteItems = params[1];
  if (!Array.isArray(quoteItems)) return null;

  for (const item of quoteItems) {
    if (!item || typeof item !== 'object' || !('n' in item) || item.n !== 'OANDA:XAUUSD') continue;
    if (!('v' in item) || !item.v || typeof item.v !== 'object') continue;

    const values = item.v;
    const price = 'lp' in values ? Number(values.lp) : NaN;
    if (!Number.isFinite(price) || price <= 0) continue;

    const readFiniteNumber = (value: unknown): number | null =>
      value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
        ? Number(value)
        : null;
    const change = 'ch' in values ? readFiniteNumber(values.ch) : null;
    const changePercent = 'chp' in values ? readFiniteNumber(values.chp) : null;

    return { price, change, changePercent };
  }

  return null;
}
