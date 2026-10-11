import { describe, expect, it } from 'bun:test';
import {
  getNextMarketOpenTimestamp,
  getNextMarketSessionBoundary,
} from '@/lib/utils/sessions';

describe('Gold market session countdown', () => {
  it('counts down to the daily weekday reopening at 6 PM New York time', () => {
    const now = new Date(Date.UTC(2026, 0, 12, 22, 30));
    expect(getNextMarketOpenTimestamp(now)).toBe(Date.UTC(2026, 0, 12, 23));
  });

  it('counts down through the weekend to Sunday at 6 PM New York time', () => {
    const now = new Date(Date.UTC(2026, 0, 9, 22));
    expect(getNextMarketOpenTimestamp(now)).toBe(Date.UTC(2026, 0, 11, 23));
  });

  it('accounts for daylight saving time across the weekend closure', () => {
    const now = new Date(Date.UTC(2026, 2, 6, 22));
    expect(getNextMarketOpenTimestamp(now)).toBe(Date.UTC(2026, 2, 8, 22));
  });

  it('returns null while the market is open', () => {
    const now = new Date(Date.UTC(2026, 0, 12, 23));
    expect(getNextMarketOpenTimestamp(now)).toBeNull();
  });

  it('counts down to the weekday market close at 5 PM New York time', () => {
    const now = new Date(Date.UTC(2026, 0, 12, 21, 30));
    expect(getNextMarketSessionBoundary(now)).toEqual({
      action: 'closes',
      timestamp: Date.UTC(2026, 0, 12, 22),
    });
  });

  it('counts down to Friday close before the weekend break', () => {
    const now = new Date(Date.UTC(2026, 0, 9, 21));
    expect(getNextMarketSessionBoundary(now)).toEqual({
      action: 'closes',
      timestamp: Date.UTC(2026, 0, 9, 22),
    });
  });
});