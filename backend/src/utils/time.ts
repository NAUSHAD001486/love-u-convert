// UTC helpers

export const getCurrentUTC = (): Date => {
  return new Date();
};

export const getUTCTimestamp = (): number => {
  return Date.now();
};

export const formatUTC = (date: Date): string => {
  return date.toISOString();
};

export const getSecondsUntilMidnightUTC = (): number => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};

export const getCurrentEpochSeconds = (): number => {
  return Math.floor(Date.now() / 1000);
};

