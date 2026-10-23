import { describe, it, expect } from 'vitest';
import { applyStatuses } from '../src/ui/update';

describe('applyStatuses', () => {
  it('marks done MIDs with checkmark', () => {
    const text = 'WPT\n12345 Ethan\n23456 John';
    const doneMap = new Map([['12345', '']]);
    const result = applyStatuses(text, doneMap);
    expect(result.replacedCount).toBe(1);
    expect(result.text).toContain('12345 ✅');
    expect(result.text).not.toContain('12345 ✅ Ethan');
  });

  it('appends note after checkmark', () => {
    const text = 'WPT\n12345 Ethan';
    const doneMap = new Map([['12345', 'flat tyre']]);
    const result = applyStatuses(text, doneMap);
    expect(result.text).toContain('12345 ✅ flat tyre');
  });

  it('leaves non-done MIDs unchanged', () => {
    const text = 'WPT\n12345 Ethan\n23456 John';
    const doneMap = new Map([['12345', 'note']]);
    const result = applyStatuses(text, doneMap);
    expect(result.text).toContain('23456 John');
  });

  it('handles multiple done MIDs', () => {
    const text = '12345 Ethan\n23456 John\n34567 Sarah';
    const doneMap = new Map([
      ['12345', ''],
      ['34567', 'VOR'],
    ]);
    const result = applyStatuses(text, doneMap);
    expect(result.replacedCount).toBe(2);
    expect(result.totalDone).toBe(2);
  });

  it('returns unchanged text for empty done map', () => {
    const text = '12345 Ethan';
    const result = applyStatuses(text, new Map());
    expect(result.replacedCount).toBe(0);
    expect(result.text).toBe(text);
  });

  it('does not match MIDs that are substrings', () => {
    const text = '112345 Ethan'; // 6 digits, not a MID
    const doneMap = new Map([['12345', '']]);
    const result = applyStatuses(text, doneMap);
    expect(result.replacedCount).toBe(0);
  });
});
