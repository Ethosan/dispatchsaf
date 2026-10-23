import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTimer,
  timeRemaining,
  startTimer,
  pauseTimer,
  resetTimer,
  toggleDone,
  tickTimers,
  summarizeTracker,
  doneVehicleMap,
  addNotePreset,
  removeNotePreset,
  syncTracker,
  WPT_TIMER_MS,
} from '../src/lib/tracker';
import type { TrackedVehicle } from '../src/types';

function makeVehicle(mid: string, purpose: 'WPT' | 'MPT' = 'WPT'): TrackedVehicle {
  return {
    mid,
    category: 'Test Cat',
    purpose,
    status: 'pending',
    note: '',
    timer: createTimer(),
  };
}

describe('createTimer', () => {
  it('creates an idle timer', () => {
    const t = createTimer();
    expect(t.state).toBe('idle');
    expect(t.startedAt).toBeNull();
    expect(t.accumulated).toBe(0);
  });
});

describe('timeRemaining', () => {
  it('returns full duration for idle timer', () => {
    const v = makeVehicle('12345');
    expect(timeRemaining(v)).toBe(WPT_TIMER_MS);
  });
  it('returns 0 for done timer', () => {
    const v = makeVehicle('12345');
    v.timer.state = 'done';
    expect(timeRemaining(v)).toBe(0);
  });
  it('counts down for running timer', () => {
    vi.useFakeTimers();
    const v = makeVehicle('12345');
    startTimer(v);
    vi.advanceTimersByTime(5000); // 5 seconds
    const remaining = timeRemaining(v);
    expect(remaining).toBeLessThan(WPT_TIMER_MS);
    expect(remaining).toBeGreaterThan(WPT_TIMER_MS - 6000);
    vi.useRealTimers();
  });
});

describe('startTimer / pauseTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts from idle', () => {
    const v = makeVehicle('12345');
    startTimer(v);
    expect(v.timer.state).toBe('running');
    expect(v.timer.startedAt).not.toBeNull();
  });

  it('does not restart a running timer', () => {
    const v = makeVehicle('12345');
    startTimer(v);
    const firstStart = v.timer.startedAt;
    vi.advanceTimersByTime(1000);
    startTimer(v); // should be no-op
    expect(v.timer.startedAt).toBe(firstStart);
  });

  it('pause accumulates elapsed time', () => {
    const v = makeVehicle('12345');
    startTimer(v);
    vi.advanceTimersByTime(10000); // 10 seconds
    pauseTimer(v);
    expect(v.timer.state).toBe('idle');
    expect(v.timer.startedAt).toBeNull();
    expect(v.timer.accumulated).toBe(10000);
  });
});

describe('resetTimer', () => {
  it('resets to idle with zero accumulated', () => {
    const v = makeVehicle('12345');
    v.timer.accumulated = 5000;
    v.timer.state = 'running';
    v.timer.startedAt = Date.now();
    resetTimer(v);
    expect(v.timer.state).toBe('idle');
    expect(v.timer.accumulated).toBe(0);
    expect(v.timer.startedAt).toBeNull();
  });
});

describe('toggleDone', () => {
  it('marks pending as done', () => {
    const v = makeVehicle('12345');
    const status = toggleDone(v);
    expect(status).toBe('done');
    expect(v.status).toBe('done');
  });
  it('marks done as pending and clears note', () => {
    const v = makeVehicle('12345');
    v.status = 'done';
    v.note = 'some note';
    const status = toggleDone(v);
    expect(status).toBe('pending');
    expect(v.note).toBe('');
  });
});

describe('tickTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('auto-completes expired timers', () => {
    const v = makeVehicle('12345');
    startTimer(v);
    vi.advanceTimersByTime(WPT_TIMER_MS + 1000); // past the limit
    const finished = tickTimers([v]);
    expect(finished).toContain('12345');
    expect(v.status).toBe('done');
    expect(v.timer.state).toBe('done');
  });

  it('returns empty for non-expired timers', () => {
    const v = makeVehicle('12345');
    startTimer(v);
    vi.advanceTimersByTime(5000);
    const finished = tickTimers([v]);
    expect(finished).toHaveLength(0);
  });
});

describe('summarizeTracker', () => {
  it('summarises WPT and MPT separately', () => {
    const tracker = [
      { ...makeVehicle('10001', 'WPT'), status: 'done' as const },
      makeVehicle('10002', 'WPT'),
      { ...makeVehicle('20001', 'MPT'), status: 'done' as const },
      makeVehicle('20002', 'MPT'),
    ];
    const s = summarizeTracker(tracker);
    expect(s.wptDone).toBe(1);
    expect(s.wptTotal).toBe(2);
    expect(s.mptDone).toBe(1);
    expect(s.mptTotal).toBe(2);
    expect(s.done).toBe(2);
    expect(s.total).toBe(4);
    expect(s.pending).toBe(2);
  });
});

describe('doneVehicleMap', () => {
  it('maps done vehicles to their notes', () => {
    const tracker = [
      { ...makeVehicle('10001'), status: 'done' as const, note: 'flat tyre' },
      makeVehicle('10002'),
      { ...makeVehicle('10003'), status: 'done' as const, note: '' },
    ];
    const map = doneVehicleMap(tracker);
    expect(map.get('10001')).toBe('flat tyre');
    expect(map.get('10003')).toBe('');
    expect(map.has('10002')).toBe(false);
  });
});

describe('addNotePreset', () => {
  it('adds a new preset to the front', () => {
    const result = addNotePreset(['old'], 'new note');
    expect(result[0]).toBe('new note');
    expect(result).toContain('old');
  });
  it('deduplicates case-insensitively', () => {
    const result = addNotePreset(['Cannot Hold Charge'], 'cannot hold charge');
    expect(result).toHaveLength(1);
  });
  it('ignores empty notes', () => {
    const result = addNotePreset(['a'], '  ');
    expect(result).toEqual(['a']);
  });
  it('caps at MAX_NOTE_PRESETS', () => {
    let presets = ['1', '2', '3', '4', '5', '6', '7', '8'];
    presets = addNotePreset(presets, '9');
    expect(presets).toHaveLength(8);
    expect(presets[0]).toBe('9');
  });
});

describe('removeNotePreset', () => {
  it('removes by index', () => {
    const presets = ['a', 'b', 'c'];
    removeNotePreset(presets, 1);
    expect(presets).toEqual(['a', 'c']);
  });
});

describe('syncTracker', () => {
  it('preserves existing state for matching MIDs', () => {
    const existing = [
      { ...makeVehicle('10001'), status: 'done' as const, note: 'flat tyre' },
    ];
    const incoming = [{ mid: '10001', category: 'New Cat', purpose: 'WPT' as const }];
    const result = syncTracker(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('done');
    expect(result[0].note).toBe('flat tyre');
    expect(result[0].category).toBe('New Cat');
  });

  it('creates new entries for new MIDs', () => {
    const existing: TrackedVehicle[] = [];
    const incoming = [{ mid: '10001', category: 'Cat', purpose: 'WPT' as const }];
    const result = syncTracker(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].timer.state).toBe('idle');
  });

  it('drops MIDs not in the incoming list', () => {
    const existing = [makeVehicle('10001'), makeVehicle('10002')];
    const incoming = [{ mid: '10001', purpose: 'WPT' as const }];
    const result = syncTracker(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].mid).toBe('10001');
  });
});
