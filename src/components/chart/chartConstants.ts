export const TIMEFRAME_SECONDS: Record<string, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '1d': 86400,
};

export const formatCountdown = (totalSeconds: number, showDays = false) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const dayPrefix = showDays && days > 0 ? `${days}d ` : '';
  return `${dayPrefix}${[hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':')}`;
};
