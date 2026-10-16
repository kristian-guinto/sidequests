/**
 * Date utilities for Philippine Standard Time (PST / PHT, UTC+8).
 */

export function getManilaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

/**
 * Returns the ISO string of the next midnight in Asia/Manila.
 */
export function getNextManilaMidnight(date: Date = new Date()): string {
  const currentDateStr = getManilaDateString(date);
  const [yearStr, monthStr, dayStr] = currentDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Tomorrow in UTC date constructor:
  // Next midnight in UTC+8 corresponds to tomorrow 00:00:00 GMT+0800.
  // In UTC time, that is (day + 1) at 00:00:00 - 8 hours = previous day 16:00:00 UTC.
  const nextDayDate = new Date(Date.UTC(year, month, day + 1, -8, 0, 0, 0));
  return nextDayDate.toISOString();
}
