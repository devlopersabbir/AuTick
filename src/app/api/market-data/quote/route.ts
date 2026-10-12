import { connection, NextResponse } from 'next/server';
import { getTradingViewGoldQuoteSnapshot } from '@/lib/market-data/tradingviewQuoteFeed';

export async function GET(): Promise<NextResponse> {
  await connection();
  const snapshot = getTradingViewGoldQuoteSnapshot();
  return NextResponse.json(
    { success: true, ...snapshot },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
