import { describe, it, expect } from 'vitest';
import { pad2, formatDate, formatTimeHM, minutesToHM, parseTime, setTimeOnDate, addDays, formatCountdown } from '../src/lib/time';

describe('pad2', () => {
  it('pads single digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
    expect(pad2(9)).toBe('09');
  });
  it('does not pad two-digit numbers', () => {
    expect(pad2(10)).toBe('10');
    expect(pad2(59)).toBe('59');
  });
});

describe('formatDate', () => {
  it('formats as DDMMYY', () => {
    const d = new Date(2026, 9, 23); // Oct 23, 2026
    expect(formatDate(d)).toBe('231026');
  });
  it('pads single-digit days and months', () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026
    expect(formatDate(d)).toBe('050126');
  });
});

describe('formatTimeHM', () => {
  it('formats as HHMM', () => {
    const d = new Date(2026, 0, 1, 8, 40);
    expect(formatTimeHM(d)).toBe('0840');
  });
  it('pads midnight', () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTimeHM(d)).toBe('0000');
  });
});

describe('minutesToHM', () => {
  it('converts minutes to HHMM', () => {
    expect(minutesToHM(0)).toBe('0000');
    expect(minutesToHM(520)).toBe('0840');
    expect(minutesToHM(1439)).toBe('2359');
  });
});

describe('parseTime', () => {
  it('parses 4-digit HHMM', () => {
    expect(parseTime('0840')).toBe(520);
    expect(parseTime('0000')).toBe(0);
    expect(parseTime('2359')).toBe(1439);
  });
  it('parses 3-digit HMM', () => {
    expect(parseTime('840')).toBe(520);
    expect(parseTime('900')).toBe(540);
  });
  it('strips separators', () => {
    expect(parseTime('08:40')).toBe(520);
    expect(parseTime('08.40')).toBe(520);
    expect(parseTime('08 40')).toBe(520);
  });
  it('returns null for invalid input', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('2500')).toBeNull();
    expect(parseTime('0860')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('12345')).toBeNull();
  });
});

describe('setTimeOnDate', () => {
  it('sets time on a date', () => {
    const base = new Date(2026, 9, 23, 15, 30);
    const result = setTimeOnDate(base, 520); // 08:40
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(40);
    expect(result.getSeconds()).toBe(0);
  });
  it('does not mutate the original date', () => {
    const base = new Date(2026, 9, 23, 15, 30);
    setTimeOnDate(base, 520);
    expect(base.getHours()).toBe(15);
  });
});

describe('addDays', () => {
  it('adds days', () => {
    const d = new Date(2026, 9, 23);
    const tomorrow = addDays(1, d);
    expect(tomorrow.getDate()).toBe(24);
  });
  it('handles month overflow', () => {
    const d = new Date(2026, 0, 31); // Jan 31
    const result = addDays(1, d);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(1);
  });
});

describe('formatCountdown', () => {
  it('formats as MM:SS', () => {
    expect(formatCountdown(20 * 60 * 1000)).toBe('20:00');
    expect(formatCountdown(5 * 60 * 1000)).toBe('05:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(59 * 1000)).toBe('00:59');
  });
});
