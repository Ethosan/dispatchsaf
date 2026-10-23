// ─── Time utilities ─────────────────────────────────────────────────────────

/** Pad a number to 2 digits. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as DDMMYY. */
export function formatDate(d: Date): string {
  return pad2(d.getDate()) + pad2(d.getMonth() + 1) + pad2(d.getFullYear() % 100);
}

/** Format a Date as HHMM. */
export function formatTimeHM(d: Date): string {
  return pad2(d.getHours()) + pad2(d.getMinutes());
}

/** Format minutes-since-midnight as HHMM. */
export function minutesToHM(min: number): string {
  return pad2(Math.floor(min / 60)) + pad2(min % 60);
}

/** Parse a HHMM or HMM string into minutes since midnight. Returns null if invalid. */
export function parseTime(input: string): number | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/[:.\s]/g, '');
  if (!/^\d{3,4}$/.test(cleaned)) return null;
  const padded = cleaned.padStart(4, '0');
  const hours = parseInt(padded.slice(0, 2), 10);
  const minutes = parseInt(padded.slice(2, 4), 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Set the time-of-day on a Date, returning a new Date. */
export function setTimeOnDate(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** Return a Date offset by N days from the given date (default: now). */
export function addDays(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format milliseconds as M:SS countdown. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  return `${pad2(Math.floor(totalSec / 60))}:${pad2(totalSec % 60)}`;
}
