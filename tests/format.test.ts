import { describe, it, expect } from 'vitest';
import { generateDispatch, plural } from '../src/lib/format';
import { parseVehicleList, extractTags } from '../src/lib/parse';
import { DEFAULT_BLOCKLIST } from '../src/lib/state';
import type { User } from '../src/types';

const user: User = { rank: 'PTE', name: 'Ethan', aliases: ['EthanT'] };

describe('generateDispatch', () => {
  it('generates blocks for matching vehicles', () => {
    const raw = `WPT
12345 Ethan
23456 John`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    expect(result.total).toBe(1);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].mid).toBe('12345');
    expect(result.blocks[0].purpose).toBe('WPT');
  });

  it('block text contains all required fields', () => {
    const raw = `WPT
12345 Ethan`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    const text = result.blocks[0].text;
    expect(text).toContain('DATE: 231026');
    expect(text).toContain('TIME: 0840-0900'); // default start 08:40 + 20 min WPT
    expect(text).toContain('MID: 12345');
    expect(text).toContain('TO: PTE ETHAN');
    expect(text).toContain('VC: -');
    expect(text).toContain('LOCATION: KHC- KHC');
    expect(text).toContain('PURPOSE: WPT');
  });

  it('uses custom start time', () => {
    const raw = `WPT
12345 Ethan`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', 600, new Date(2026, 9, 23)); // 10:00

    expect(result.blocks[0].text).toContain('TIME: 1000-1020');
  });

  it('WPT blocks use 20-minute slots', () => {
    const raw = `WPT
12345 Ethan
23456 EthanT`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    expect(result.blocks).toHaveLength(2);
    // First: 0840-0900, second: 0905-0925 (5 min gap)
    expect(result.blocks[0].text).toContain('TIME: 0840-0900');
    expect(result.blocks[1].text).toContain('TIME: 0905-0925');
  });

  it('MPT blocks use 30-minute slots', () => {
    const raw = `MPT
12345 Ethan`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    expect(result.blocks[0].text).toContain('TIME: 0840-0910');
    expect(result.blocks[0].purpose).toBe('MPT');
  });

  it('uses embedded time when present', () => {
    const raw = `WPT
12345 Ethan 1000 - 1030`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    expect(result.embeddedCount).toBe(1);
    expect(result.blocks[0].text).toContain('TIME: 1000-1030');
  });

  it('counts WPT overflow', () => {
    const raw = `WPT
10001 Ethan
10002 Ethan
10003 Ethan
10004 Ethan
10005 Ethan
10006 Ethan`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026', null, new Date(2026, 9, 23));

    expect(result.wptCount).toBe(6);
    expect(result.wptOverflow).toBe(1); // 6 - 5 soft cap
  });

  it('returns zero for no matches', () => {
    const raw = `WPT
12345 John`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026');

    expect(result.total).toBe(0);
    expect(result.blocks).toHaveLength(0);
  });

  it('generates tracker vehicles', () => {
    const raw = `WPT
12345 Ethan
MPT
67890 Ethan`;
    const list = extractTags(parseVehicleList(raw), DEFAULT_BLOCKLIST);
    const result = generateDispatch(user, list, '231026');

    expect(result.allMatches).toHaveLength(2);
    expect(result.allMatches[0].status).toBe('pending');
    expect(result.allMatches[0].timer.state).toBe('idle');
  });
});

describe('plural', () => {
  it('singular for 1', () => {
    expect(plural(1, 'vehicle')).toBe('1 vehicle');
  });
  it('plural for 0', () => {
    expect(plural(0, 'vehicle')).toBe('0 vehicles');
  });
  it('plural for many', () => {
    expect(plural(5, 'vehicle')).toBe('5 vehicles');
  });
});
