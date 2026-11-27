/** m:ss.t, e.g. 1:05.3 */
export const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

/** m:ss for the results card. */
export const formatTimeShort = (seconds: number): string => formatTime(seconds).replace(/\.\d$/, '');
