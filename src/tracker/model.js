/* Tracker state: one entry per dispatched vehicle, with a done flag, an
   optional note, and (for WPT) a 20-minute countdown that survives reloads. */
import { S, save } from "../store.js";

export const TIMER_DURATION_MS = 20 * 60 * 1000;
const MAX_PRESETS = 8;

const find = mid => S.tracker.find(v => v.mid === mid);
const idleTimer = () => ({ state: "idle", startedAt: null, accumulated: 0 });

/* Merge freshly generated matches into the tracker, keeping progress on
   vehicles that are still listed and dropping those that are not. */
export function syncToTracker(matches) {
  const existing = new Map(S.tracker.map(v => [v.mid, v]));
  S.tracker = matches.map(m => {
    const prev = existing.get(m.mid);
    return prev
      ? { ...prev, category: m.category || prev.category, purpose: m.purpose }
      : { mid: m.mid, category: m.category || "", purpose: m.purpose, status: "pending", note: "", timer: idleTimer() };
  });
  save.tracker();
}

export function clearTracker() {
  S.tracker = [];
  save.tracker();
}

export function timerRemaining(v) {
  if (v.timer.state === "done") return 0;
  let elapsed = v.timer.accumulated;
  if (v.timer.state === "running" && v.timer.startedAt) elapsed += Date.now() - v.timer.startedAt;
  return Math.max(0, TIMER_DURATION_MS - elapsed);
}

function stopClock(v) {
  if (v.timer.state !== "running") return;
  v.timer.accumulated += Date.now() - v.timer.startedAt;
  v.timer.state = "idle";
  v.timer.startedAt = null;
}

export function startTimer(mid) {
  const v = find(mid);
  if (!v || v.timer.state !== "idle") return;
  v.timer.state = "running";
  v.timer.startedAt = Date.now();
  save.tracker();
}

export function pauseTimer(mid) {
  const v = find(mid);
  if (!v) return;
  stopClock(v);
  save.tracker();
}

/* Resetting the timer leaves the done flag alone: it may have been set by hand. */
export function resetTimer(mid) {
  const v = find(mid);
  if (!v) return;
  v.timer = idleTimer();
  save.tracker();
}

export function toggleStatus(mid) {
  const v = find(mid);
  if (!v) return null;
  if (v.status === "pending") {
    v.status = "done";
    stopClock(v);
  } else {
    v.status = "pending";
    v.note = "";
  }
  save.tracker();
  return v.status;
}

export function setNote(mid, note) {
  const v = find(mid);
  if (!v) return;
  v.note = note;
  save.tracker();
}

/* Remember a note as a preset, most recent first. */
export function rememberPreset(note) {
  const t = (note || "").trim();
  if (!t) return;
  S.notePresets = [t, ...S.notePresets.filter(n => n.toLowerCase() !== t.toLowerCase())].slice(0, MAX_PRESETS);
  save.notePresets();
}

export function deletePreset(idx) {
  S.notePresets.splice(idx, 1);
  save.notePresets();
}

/* Advance running timers. Returns the MIDs that just finished. */
export function tick() {
  const finished = [];
  for (const v of S.tracker) {
    if (v.timer.state === "running" && timerRemaining(v) <= 0) {
      v.timer = { state: "done", startedAt: null, accumulated: TIMER_DURATION_MS };
      v.status = "done";
      v.note = "";
      finished.push(v.mid);
    }
  }
  if (finished.length) save.tracker();
  return finished;
}

export function counts() {
  const wpt = S.tracker.filter(v => v.purpose === "WPT");
  const mpt = S.tracker.filter(v => v.purpose === "MPT");
  const done = list => list.filter(v => v.status === "done").length;
  return {
    wptDone: done(wpt), wptTotal: wpt.length,
    mptDone: done(mpt), mptTotal: mpt.length,
    running: S.tracker.filter(v => v.timer.state === "running").length,
    pending: S.tracker.filter(v => v.status === "pending").length,
    done: done(S.tracker),
    total: S.tracker.length,
  };
}

/* MID -> note for every vehicle marked done. */
export function doneMap() {
  return new Map(S.tracker.filter(v => v.status === "done").map(v => [v.mid, v.note || ""]));
}
