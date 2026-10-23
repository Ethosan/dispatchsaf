// ─── Application state ──────────────────────────────────────────────────────

import type { AppState, Theme, User } from '../types';
import { STORAGE_KEYS, loadJSON, loadString, saveString } from './storage';

/** Default blocklist of status codes (words after a MID that are not names). */
export const DEFAULT_BLOCKLIST: string[] = [
  'SI', '10C4I', 'VEH DEAD', 'VOR', 'MBI', 'CET', 'JIT',
  'AB DUTY', 'AMB DUTY', 'AMB RECCE', 'AUTOBOT', 'HQ SIG', 'SD',
  '41 SD', '41SAR', 'SAR', 'NO SKILLSET', 'NO NEED', 'NO KEY',
  'NO POWER', 'ISSUED OUT', 'D/B', 'DRIVEBACK', 'FERRY', 'KIV',
  'Maint', 'Loan out', 'Key not in', 'KEY NOT INSIDE', 'KEY NOT IN',
  'KEY NOT IN KEYPRESS', 'key not in press', 'key not in keypress',
  'REDBOX', 'RED BOX', 'VEH in red box',
  'cannot hold charge', 'CANNOT HOLD CHARGE', 'Cnnt Hold Charge',
  'CANNOT HE CHARGE', 'battery cannot hold charge',
  'battery cannot hold charge after jumpstart',
  'battery died while engine was on', 'AVI Fail',
  'steering wheel faulty', 'steering wheel problem',
  'IVC not working', 'engine light on', 'flat tyre',
  'flat tyre with hholes', 'REAR LEFT TYRE FLAT',
  "NO POWER AND CAN'T JUMPSTART", 'NO POWER AND CANT JUMPSTART',
  'IGNITION BATTERY PROBLEM', 'IGNITION AND BATTERY PROBLEM',
  'breakdown at KC3', 'at 10C4I',
  'LEFT MIDDLE INDICATOR NOT WORKING',
  'to shift', 'to be driven', 'Driven', 'Route Ori', 'Route Origin',
  'got aircon', 'for cet', 'T-LOAN SGN', 'T-LOAN TO SGN',
];

const DEFAULT_NOTE_PRESETS: string[] = ['cannot hold charge'];

/** Deduplicate a list of strings (case-insensitive, preserving original casing). */
function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const key = String(item).toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Normalise a user object from storage. */
function normalizeUser(u: unknown): User {
  const obj = u as Record<string, unknown>;
  return {
    rank: (obj.rank as User['rank']) || 'PTE',
    name: String(obj.name || obj.tag || ''),
    aliases: Array.isArray(obj.aliases) ? (obj.aliases as string[]) : [],
  };
}

/** Load the full app state from localStorage. */
export function loadState(): AppState {
  const activeRaw = parseInt(loadString('active') ?? '', 10);
  const users = (loadJSON<unknown[]>('users', []) as unknown[]).map(normalizeUser);

  return {
    users,
    activeIdx: isNaN(activeRaw) ? -1 : activeRaw,
    blocklist: loadJSON<string[]>('blocklist', null as unknown as string[]) ?? dedupe(DEFAULT_BLOCKLIST),
    theme: (loadString('theme') as Theme) || 'auto',
    autoGen: loadString('autoGen') !== 'off',
    trackerEnabled: loadString('trackerEnabled') !== 'off',
    tracker: loadJSON('tracker', []),
    notePresets: loadJSON<string[]>('notePresets', null as unknown as string[]) ?? [...DEFAULT_NOTE_PRESETS],
    page: 'deploy',
    dayOffset: 0,
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────

export const persist = {
  users(state: AppState): void {
    saveString('users', JSON.stringify(state.users));
    saveString('active', String(state.activeIdx));
  },
  blocklist(state: AppState): void {
    saveString('blocklist', JSON.stringify(state.blocklist));
  },
  theme(state: AppState): void {
    saveString('theme', state.theme);
  },
  autoGen(state: AppState): void {
    saveString('autoGen', state.autoGen ? 'on' : 'off');
  },
  trackerEnabled(state: AppState): void {
    saveString('trackerEnabled', state.trackerEnabled ? 'on' : 'off');
  },
  tracker(state: AppState): void {
    saveString('tracker', JSON.stringify(state.tracker));
  },
  notePresets(state: AppState): void {
    saveString('notePresets', JSON.stringify(state.notePresets));
  },
};

// ─── Backup / Restore ───────────────────────────────────────────────────────

export function exportBackup(state: AppState): string {
  return JSON.stringify(
    {
      app: 'dispatch',
      version: 1,
      exportedAt: new Date().toISOString(),
      users: state.users,
      activeIdx: state.activeIdx,
      blocklist: state.blocklist,
      notePresets: state.notePresets,
    },
    null,
    2
  );
}

export function importBackup(state: AppState, json: string): void {
  const data = JSON.parse(json);
  if (!data || data.app !== 'dispatch' || !Array.isArray(data.users)) {
    throw new Error('Not a Dispatch backup file');
  }
  state.users = data.users.map(normalizeUser);
  state.activeIdx =
    Number.isInteger(data.activeIdx) && data.activeIdx < state.users.length
      ? data.activeIdx
      : state.users.length
        ? 0
        : -1;
  if (Array.isArray(data.blocklist)) state.blocklist = dedupe(data.blocklist);
  if (Array.isArray(data.notePresets)) state.notePresets = data.notePresets.slice(0, 8);

  persist.users(state);
  persist.blocklist(state);
  persist.notePresets(state);
}

/** Get the active user or null. */
export function activeUser(state: AppState): User | null {
  if (state.activeIdx >= 0 && state.activeIdx < state.users.length) {
    return state.users[state.activeIdx];
  }
  return null;
}

export { STORAGE_KEYS };
