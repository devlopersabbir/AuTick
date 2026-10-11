/**
 * Market Sessions and Trading Hours Utilities for XAUUSD (Gold / US Dollar)
 *
 * Spot Gold (XAUUSD) trades 23 hours a day, 5 days a week:
 * - Opens: Sunday at 6:00 PM New York Time (22:00 UTC)
 * - Closes: Friday at 5:00 PM New York Time (21:00 UTC)
 * - Daily Rollover Break: 5:00 PM - 6:00 PM New York Time (Mon-Thu)
 *
 * Key Global Trading Sessions (in New York EDT / America/New_York):
 * - Sydney:   5:00 PM - 2:00 AM EDT
 * - Tokyo:    8:00 PM - 5:00 AM EDT
 * - London:   3:00 AM - 12:00 PM EDT
 * - New York: 8:00 AM - 5:00 PM EDT (Peak volume overlap with London: 8:00 AM - 12:00 PM EDT)
 */

export interface MarketSessionDetail {
  id: 'sydney' | 'tokyo' | 'london' | 'new_york';
  name: string;
  shortName: string;
  icon: string;
  isOpen: boolean;
  hoursNy: string;
  hoursUtc: string;
}

export interface SessionInfo {
  timestamp: number;
  isMarketOpen: boolean;
  closeReason: string | null;
  primarySession: string;
  nyTime12: string;        // e.g. "09:15 AM"
  nyTimeWithZone: string;  // e.g. "09:15 AM EDT"
  nyDateStr: string;       // e.g. "Oct 11, 2026"
  nyFullDisplay: string;   // e.g. "Oct 11, 09:15 AM EDT"
  nyHour: number;
  nyMinute: number;
  weekday: string;
  sessions: MarketSessionDetail[];
}

export function getSessionInfo(timestampInSeconds: number): SessionInfo {
  if (!timestampInSeconds || isNaN(timestampInSeconds)) {
    return {
      timestamp: 0,
      isMarketOpen: false,
      closeReason: 'No Data',
      primarySession: 'Unknown',
      nyTime12: '--:-- --',
      nyTimeWithZone: '--:-- --',
      nyDateStr: '----',
      nyFullDisplay: '---- --:-- --',
      nyHour: 0,
      nyMinute: 0,
      weekday: '',
      sessions: [],
    };
  }

  const d = new Date(timestampInSeconds * 1000);

  // Parse time components in America/New_York timezone
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

  const partMap: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    partMap[p.type] = p.value;
  }

  const weekday = partMap.weekday || 'Mon';
  const month = partMap.month || 'Jan';
  const day = partMap.day || '1';
  const year = partMap.year || '2026';
  const hour24 = parseInt(partMap.hour || '0', 10);
  const minute = parseInt(partMap.minute || '0', 10);

  // Format 12-hour AM/PM
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutePadded = minute.toString().padStart(2, '0');
  const nyTime12 = `${hour12.toString().padStart(2, '0')}:${minutePadded} ${ampm}`;
  const nyDateStr = `${month} ${day}, ${year}`;
  const nyTimeWithZone = `${nyTime12} NY`;
  const nyFullDisplay = `${month} ${day}, ${nyTime12} NY`;

  // Determine if Market is OPEN or CLOSED
  let isMarketOpen = true;
  let closeReason: string | null = null;

  if (weekday === 'Sat') {
    isMarketOpen = false;
    closeReason = 'Weekend Break';
  } else if (weekday === 'Fri' && (hour24 > 17 || (hour24 === 17 && minute >= 0))) {
    isMarketOpen = false;
    closeReason = 'Weekend Break';
  } else if (weekday === 'Sun' && hour24 < 18) {
    isMarketOpen = false;
    closeReason = 'Weekend Break';
  } else if (weekday !== 'Fri' && weekday !== 'Sat' && weekday !== 'Sun' && hour24 === 17) {
    isMarketOpen = false;
    closeReason = 'Daily Rollover Break';
  }

  // Calculate individual session active states
  const isNyOpen = isMarketOpen && hour24 >= 8 && hour24 < 17;
  const isLondonOpen = isMarketOpen && hour24 >= 3 && hour24 < 12;
  const isTokyoOpen = isMarketOpen && (hour24 >= 20 || hour24 < 5);
  const isSydneyOpen = isMarketOpen && (hour24 >= 17 || hour24 < 2);

  const sessions: MarketSessionDetail[] = [
    {
      id: 'new_york',
      name: 'New York Session',
      shortName: 'New York',
      icon: '🗽',
      isOpen: isNyOpen,
      hoursNy: '8:00 AM - 5:00 PM',
      hoursUtc: '12:00 - 21:00 UTC',
    },
    {
      id: 'london',
      name: 'London Session',
      shortName: 'London',
      icon: '🏛️',
      isOpen: isLondonOpen,
      hoursNy: '3:00 AM - 12:00 PM',
      hoursUtc: '07:00 - 16:00 UTC',
    },
    {
      id: 'tokyo',
      name: 'Tokyo Session',
      shortName: 'Tokyo (Asia)',
      icon: '🏯',
      isOpen: isTokyoOpen,
      hoursNy: '8:00 PM - 5:00 AM',
      hoursUtc: '00:00 - 09:00 UTC',
    },
    {
      id: 'sydney',
      name: 'Sydney Session',
      shortName: 'Sydney',
      icon: '🌙',
      isOpen: isSydneyOpen,
      hoursNy: '5:00 PM - 2:00 AM',
      hoursUtc: '21:00 - 06:00 UTC',
    },
  ];

  // Primary active session label
  let primarySession = 'Off-Hours';
  if (!isMarketOpen) {
    primarySession = `Market Closed (${closeReason})`;
  } else if (isNyOpen && isLondonOpen) {
    primarySession = 'London / NY Overlap (Peak)';
  } else if (isNyOpen) {
    primarySession = 'New York Session';
  } else if (isLondonOpen) {
    primarySession = 'London Session';
  } else if (isTokyoOpen) {
    primarySession = 'Tokyo (Asian) Session';
  } else if (isSydneyOpen) {
    primarySession = 'Sydney Session';
  }

  return {
    timestamp: timestampInSeconds,
    isMarketOpen,
    closeReason,
    primarySession,
    nyTime12,
    nyTimeWithZone,
    nyDateStr,
    nyFullDisplay,
    nyHour: hour24,
    nyMinute: minute,
    weekday,
    sessions,
  };
}

export interface MarketSessionBoundary {
  action: 'opens' | 'closes';
  timestamp: number;
}

export function getNextMarketSessionBoundary(now: Date = new Date()): MarketSessionBoundary {
  const nowTimestamp = Math.floor(now.getTime() / 1000);
  const session = getSessionInfo(nowTimestamp);
  const action = session.isMarketOpen ? 'closes' : 'opens';

  const newYorkFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  const localParts = Object.fromEntries(
    newYorkFormatter.formatToParts(now).map(({ type, value }) => [type, value])
  );
  const year = Number(localParts.year);
  const month = Number(localParts.month);
  const day = Number(localParts.day);
  const weekday = localParts.weekday;
  const daysUntilBoundary = session.isMarketOpen
    ? (weekday === 'Sun' ? 1 : 0)
    : (weekday === 'Sat' ? 1 : weekday === 'Fri' ? 2 : 0);
  const targetDate = new Date(Date.UTC(year, month - 1, day + daysUntilBoundary));
  const targetWallTime = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    session.isMarketOpen ? 17 : 18
  );

  // Resolve the New York wall time to UTC, including the current DST offset.
  let targetTimestamp = targetWallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const targetParts = Object.fromEntries(
      newYorkFormatter.formatToParts(new Date(targetTimestamp)).map(({ type, value }) => [type, value])
    );
    const targetAsUtc = Date.UTC(
      Number(targetParts.year),
      Number(targetParts.month) - 1,
      Number(targetParts.day),
      Number(targetParts.hour),
      Number(targetParts.minute),
      Number(targetParts.second)
    );
    targetTimestamp += targetWallTime - targetAsUtc;
  }

  return { action, timestamp: targetTimestamp };
}

export function getNextMarketOpenTimestamp(now: Date = new Date()): number | null {
  const boundary = getNextMarketSessionBoundary(now);
  return boundary.action === 'opens' ? boundary.timestamp : null;
}

/**
 * Format tick mark timestamp for Lightweight Charts bottom timescale in AM/PM
 */
export function formatTickMarkAmPm(timestampInSeconds: number, tickMarkType?: number): string {
  if (!timestampInSeconds) return '';
  const d = new Date(timestampInSeconds * 1000);

  // In Lightweight Charts, TickMarkType:
  // 0: Year, 1: Month, 2: DayOfMonth, 3: Time, 4: TimeWithSeconds
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: true,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const partMap: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    partMap[p.type] = p.value;
  }

  // If new day mark (tickMarkType <= 2)
  if (tickMarkType !== undefined && tickMarkType <= 2) {
    return `${partMap.month} ${partMap.day}`;
  }

  const hour = partMap.hour || '12';
  const minute = partMap.minute || '00';
  const ampm = partMap.dayPeriod || (parseInt(partMap.hour || '0', 10) >= 12 ? 'PM' : 'AM');

  // If exactly on the hour, omit :00 for clean chart axis
  if (minute === '00') {
    return `${hour} ${ampm}`;
  }

  return `${hour}:${minute} ${ampm}`;
}

/**
 * Format crosshair tooltip time with session and New York AM/PM
 */
export function formatCrosshairTimeWithSession(timestampInSeconds: number): string {
  const session = getSessionInfo(timestampInSeconds);
  if (!session.isMarketOpen) {
    return `${session.nyFullDisplay} • 🔴 Closed (${session.closeReason})`;
  }
  return `${session.nyFullDisplay} • ${session.primarySession}`;
}
