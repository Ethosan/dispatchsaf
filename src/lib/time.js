/* Date and time helpers. Dispatch formats dates as DDMMYY and times as HHMM. */

export const pad = n => String(n).padStart(2, "0");
export const ddmmyy = d => pad(d.getDate()) + pad(d.getMonth() + 1) + pad(d.getFullYear() % 100);
export const hhmm = d => pad(d.getHours()) + pad(d.getMinutes());
export const minutesToHhmm = m => pad(Math.floor(m / 60)) + pad(m % 60);

/* Parse an HHMM start time ("0840", "840", "08:40"). Returns minutes since midnight, or null. */
export function parseTimeInput(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/[:.\s]/g, "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const padded = s.padStart(4, "0");
  const h = parseInt(padded.slice(0, 2), 10);
  const m = parseInt(padded.slice(2, 4), 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/* A copy of refDate at the given minutes of the day. */
export function dateAtMinutesOfDay(refDate, minutes) {
  const d = new Date(refDate);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/* Today, or today plus dayOffset days. */
export function dateWithOffset(dayOffset, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  return d;
}
