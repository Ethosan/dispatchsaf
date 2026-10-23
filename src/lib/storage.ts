// ─── localStorage helpers ───────────────────────────────────────────────────

const KEYS = {
  users: 'dispatch.users.v3',
  active: 'dispatch.active.v3',
  blocklist: 'dispatch.blocklist.v3',
  theme: 'dispatch.theme.v1',
  autoGen: 'dispatch.autogen.v1',
  trackerEnabled: 'dispatch.trackerEnabled.v1',
  tracker: 'dispatch.trackerVehicles.v1',
  notePresets: 'dispatch.notePresets.v1',
} as const;

export function loadString(key: keyof typeof KEYS): string | null {
  try {
    return localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export function saveString(key: keyof typeof KEYS, value: string): void {
  try {
    localStorage.setItem(KEYS[key], value);
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function loadJSON<T>(key: keyof typeof KEYS, fallback: T): T {
  try {
    const raw = loadString(key);
    const parsed = JSON.parse(raw ?? 'null');
    return (Array.isArray(parsed) ? parsed : fallback) as T;
  } catch {
    return fallback;
  }
}

export { KEYS as STORAGE_KEYS };
