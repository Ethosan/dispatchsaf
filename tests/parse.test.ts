import { describe, it, expect } from 'vitest';
import { parseTimeRange, extractTag, parseVehicleList, extractTags, vehicleMatchesUser } from '../src/lib/parse';
import { DEFAULT_BLOCKLIST } from '../src/lib/state';

describe('parseTimeRange', () => {
  it('parses HHMM-HHMM', () => {
    const result = parseTimeRange('0800 - 0900');
    expect(result).not.toBeNull();
    expect(result!.startMin).toBe(480);
    expect(result!.endMin).toBe(540);
  });
  it('parses with en-dash', () => {
    const result = parseTimeRange('0800 – 0900');
    expect(result).not.toBeNull();
    expect(result!.startMin).toBe(480);
  });
  it('parses with em-dash', () => {
    const result = parseTimeRange('0800 — 0900');
    expect(result).not.toBeNull();
  });
  it('returns null for invalid times', () => {
    expect(parseTimeRange('2500 - 2600')).toBeNull();
    expect(parseTimeRange('no time here')).toBeNull();
  });
});

describe('extractTag', () => {
  it('extracts a name from a line', () => {
    expect(extractTag('Ethan PTE', [])).toBe('Ethan');
  });
  it('returns null for empty input', () => {
    expect(extractTag('', [])).toBeNull();
  });
  it('strips blocklisted status codes', () => {
    expect(extractTag('SI VEH DEAD', DEFAULT_BLOCKLIST)).toBeNull();
  });
  it('strips parenthesised content', () => {
    expect(extractTag('Ethan (Auto)', [])).toBe('Ethan');
  });
  it('strips bracketed content', () => {
    expect(extractTag('Ethan [KIV]', [])).toBe('Ethan');
  });
  it('strips time ranges and dates', () => {
    expect(extractTag('detail 1/2', [])).toBeNull();
  });
  it('returns null for purely numeric input', () => {
    expect(extractTag('12345', [])).toBeNull();
  });
  it('extracts first word as tag', () => {
    expect(extractTag('John Smith', [])).toBe('John');
  });
});

describe('parseVehicleList', () => {
  it('parses a simple WPT list', () => {
    const raw = `WPT
12345 Ethan
23456 John`;
    const result = parseVehicleList(raw);
    expect(result.WPT).toHaveLength(2);
    expect(result.WPT[0].mid).toBe('12345');
    expect(result.WPT[0].rawRest).toContain('Ethan');
    expect(result.MPT).toHaveLength(0);
  });

  it('parses WPT and MPT sections', () => {
    const raw = `WPT
12345 Ethan
MPT
67890 Sarah`;
    const result = parseVehicleList(raw);
    expect(result.WPT).toHaveLength(1);
    expect(result.MPT).toHaveLength(1);
    expect(result.WPT[0].mid).toBe('12345');
    expect(result.MPT[0].mid).toBe('67890');
  });

  it('captures vehicle categories', () => {
    const raw = `WPT
5 Ton (CP)
12345 Ethan`;
    const result = parseVehicleList(raw);
    expect(result.WPT[0].category).toBe('5 Ton (CP)');
  });

  it('extracts embedded time ranges', () => {
    const raw = `WPT
12345 Ethan 0800 - 0900`;
    const result = parseVehicleList(raw);
    expect(result.WPT[0].embeddedTime).not.toBeNull();
    expect(result.WPT[0].embeddedTime!.startMin).toBe(480);
    expect(result.WPT[0].embeddedTime!.endMin).toBe(540);
  });

  it('handles === separators', () => {
    const raw = `WPT
===
12345 Ethan`;
    const result = parseVehicleList(raw);
    expect(result.WPT).toHaveLength(1);
  });

  it('strips emoji markers', () => {
    const raw = `WPT
✅ 12345 Ethan`;
    const result = parseVehicleList(raw);
    expect(result.WPT).toHaveLength(1);
    expect(result.WPT[0].mid).toBe('12345');
  });

  it('handles multi-vehicle categories', () => {
    const raw = `WPT
Ford Everest OUV
12345 Ethan
AGILIS
23456 John`;
    const result = parseVehicleList(raw);
    expect(result.WPT).toHaveLength(2);
    expect(result.WPT[0].category).toBe('Ford Everest OUV');
    expect(result.WPT[1].category).toBe('AGILIS');
  });

  it('returns empty lists for empty input', () => {
    const result = parseVehicleList('');
    expect(result.WPT).toHaveLength(0);
    expect(result.MPT).toHaveLength(0);
  });
});

describe('extractTags', () => {
  it('extracts tags using blocklist', () => {
    const raw = `WPT
12345 SI VEH DEAD
23456 Ethan`;
    const list = parseVehicleList(raw);
    extractTags(list, DEFAULT_BLOCKLIST);
    expect(list.WPT[0].tag).toBeNull();
    expect(list.WPT[1].tag).toBe('Ethan');
  });
});

describe('vehicleMatchesUser', () => {
  const user = { rank: 'PTE' as const, name: 'Ethan', aliases: ['EthanT', 'ET'] };

  it('matches by name', () => {
    const vehicle = { mid: '12345', category: null, rawRest: 'Ethan PTE', tag: 'Ethan', embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(true);
  });

  it('matches by alias', () => {
    const vehicle = { mid: '12345', category: null, rawRest: 'EthanT', tag: 'EthanT', embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(true);
  });

  it('matches case-insensitively', () => {
    const vehicle = { mid: '12345', category: null, rawRest: 'ethan', tag: 'ethan', embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(true);
  });

  it('does not match different names', () => {
    const vehicle = { mid: '12345', category: null, rawRest: 'John', tag: 'John', embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(false);
  });

  it('does not match partial names', () => {
    const vehicle = { mid: '12345', category: null, rawRest: 'EthanXXX', tag: 'EthanXXX', embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(false);
  });

  it('returns false for empty rawRest', () => {
    const vehicle = { mid: '12345', category: null, rawRest: '', tag: null, embeddedTime: null };
    expect(vehicleMatchesUser(vehicle, user)).toBe(false);
  });
});
