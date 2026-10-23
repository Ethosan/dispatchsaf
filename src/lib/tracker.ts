// ─── Tracker logic ──────────────────────────────────────────────────────────

import type { TrackedVehicle, TrackerSummary, VehicleStatus, VehicleTimer } from '../types';

/** WPT timer duration in milliseconds (20 minutes). */
export const WPT_TIMER_MS = 20 * 60 * 1000;
/** Maximum number of note presets saved. */
export const MAX_NOTE_PRESETS = 8;

/** Create a fresh idle timer. */
export function createTimer(): VehicleTimer {
  return { state: 'idle', startedAt: null, accumulated: 0 };
}

/** Remaining milliseconds on a timer. */
export function timeRemaining(vehicle: TrackedVehicle): number {
  if (vehicle.timer.state === 'done') return 0;
  let elapsed = vehicle.timer.accumulated;
  if (vehicle.timer.state === 'running' && vehicle.timer.startedAt) {
    elapsed += Date.now() - vehicle.timer.startedAt;
  }
  return Math.max(0, WPT_TIMER_MS - elapsed);
}

/** Stop a running timer, folding elapsed time into accumulated. */
export function pauseTimer(vehicle: TrackedVehicle): void {
  if (vehicle.timer.state === 'running' && vehicle.timer.startedAt) {
    vehicle.timer.accumulated += Date.now() - vehicle.timer.startedAt;
    vehicle.timer.state = 'idle';
    vehicle.timer.startedAt = null;
  }
}

/** Start a timer from idle. */
export function startTimer(vehicle: TrackedVehicle): void {
  if (vehicle.timer.state !== 'idle') return;
  vehicle.timer.state = 'running';
  vehicle.timer.startedAt = Date.now();
}

/** Reset a timer to idle with zero accumulated time. */
export function resetTimer(vehicle: TrackedVehicle): void {
  vehicle.timer = createTimer();
}

/** Toggle a vehicle between pending and done. Returns the new status. */
export function toggleDone(vehicle: TrackedVehicle): VehicleStatus {
  if (vehicle.status === 'pending') {
    vehicle.status = 'done';
    pauseTimer(vehicle);
  } else {
    vehicle.status = 'pending';
    vehicle.note = '';
  }
  return vehicle.status;
}

/** Check all running timers; auto-complete any that have expired. Returns MIDs that just finished. */
export function tickTimers(tracker: TrackedVehicle[]): string[] {
  const finished: string[] = [];
  for (const vehicle of tracker) {
    if (vehicle.timer.state === 'running' && timeRemaining(vehicle) <= 0) {
      vehicle.timer = { state: 'done', startedAt: null, accumulated: WPT_TIMER_MS };
      vehicle.status = 'done';
      vehicle.note = '';
      finished.push(vehicle.mid);
    }
  }
  return finished;
}

/** Compute summary stats for the tracker. */
export function summarizeTracker(tracker: TrackedVehicle[]): TrackerSummary {
  const wpt = tracker.filter(v => v.purpose === 'WPT');
  const mpt = tracker.filter(v => v.purpose === 'MPT');
  const countDone = (list: TrackedVehicle[]) => list.filter(v => v.status === 'done').length;

  return {
    wptDone: countDone(wpt),
    wptTotal: wpt.length,
    mptDone: countDone(mpt),
    mptTotal: mpt.length,
    running: tracker.filter(v => v.timer.state === 'running').length,
    pending: tracker.filter(v => v.status === 'pending').length,
    done: countDone(tracker),
    total: tracker.length,
  };
}

/** Build a map of MID → note for all completed vehicles. */
export function doneVehicleMap(tracker: TrackedVehicle[]): Map<string, string> {
  return new Map(
    tracker
      .filter(v => v.status === 'done')
      .map(v => [v.mid, v.note || ''])
  );
}

/** Add a note to the presets list (deduped, capped). */
export function addNotePreset(presets: string[], note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return presets;
  return [trimmed, ...presets.filter(p => p.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_NOTE_PRESETS);
}

/** Remove a note preset by index. */
export function removeNotePreset(presets: string[], index: number): string[] {
  presets.splice(index, 1);
  return presets;
}

/**
 * Merge a new vehicle list into the existing tracker, preserving timer/note state for MIDs that persist.
 */
export function syncTracker(
  existing: TrackedVehicle[],
  incoming: Array<{ mid: string; category?: string; purpose: 'WPT' | 'MPT' }>
): TrackedVehicle[] {
  const existingMap = new Map(existing.map(v => [v.mid, v]));
  return incoming.map(v => {
    const prev = existingMap.get(v.mid);
    if (prev) {
      return { ...prev, category: v.category || prev.category, purpose: v.purpose };
    }
    return {
      mid: v.mid,
      category: v.category || '',
      purpose: v.purpose,
      status: 'pending' as const,
      note: '',
      timer: createTimer(),
    };
  });
}
