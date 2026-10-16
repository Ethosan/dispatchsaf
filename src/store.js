/* App state, persisted to localStorage. Keys keep their v1/v3 names so
   existing installs keep their users, status codes and tracker. */

const KEYS = {
  users: "dispatch.users.v3",
  active: "dispatch.active.v3",
  blocklist: "dispatch.blocklist.v3",
  theme: "dispatch.theme.v1",
  autoGen: "dispatch.autogen.v1",
  trackerEnabled: "dispatch.trackerEnabled.v1",
  tracker: "dispatch.trackerVehicles.v1",
  notePresets: "dispatch.notePresets.v1",
};

/* Status codes that can follow a MID and are not names. */
export const DEFAULT_BLOCKLIST = [
  "SI", "10C4I", "VEH DEAD", "VOR", "MBI", "CET", "JIT",
  "AB DUTY", "AMB DUTY", "AMB RECCE", "AUTOBOT",
  "HQ SIG", "SD", "41 SD", "41SAR", "SAR",
  "NO SKILLSET", "NO NEED", "NO KEY", "NO POWER",
  "ISSUED OUT", "D/B", "DRIVEBACK", "FERRY", "KIV", "Maint",
  "Loan out",
  "Key not in", "KEY NOT INSIDE", "KEY NOT IN", "KEY NOT IN KEYPRESS",
  "key not in press", "key not in keypress",
  "REDBOX", "RED BOX", "VEH in red box",
  "cannot hold charge", "CANNOT HOLD CHARGE", "Cnnt Hold Charge", "CANNOT HE CHARGE",
  "battery cannot hold charge", "battery cannot hold charge after jumpstart",
  "battery died while engine was on", "AVI Fail",
  "steering wheel faulty", "steering wheel problem",
  "IVC not working", "engine light on",
  "flat tyre", "flat tyre with hholes", "REAR LEFT TYRE FLAT",
  "NO POWER AND CAN'T JUMPSTART", "NO POWER AND CANT JUMPSTART",
  "IGNITION BATTERY PROBLEM", "IGNITION AND BATTERY PROBLEM",
  "breakdown at KC3", "at 10C4I",
  "LEFT MIDDLE INDICATOR NOT WORKING",
  "to shift", "to be driven", "Driven",
  "Route Ori", "Route Origin", "got aircon", "for cet",
  "T-LOAN SGN", "T-LOAN TO SGN",
];

const DEFAULT_NOTE_PRESETS = ["cannot hold charge"];

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage full or blocked */ }
}
function readJSON(key, fallback) {
  try {
    const v = JSON.parse(read(key) ?? "null");
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function dedupeBlocklist(arr) {
  const seen = new Set(), out = [];
  for (const c of arr) {
    const k = String(c).toLowerCase().trim();
    if (k && !seen.has(k)) { seen.add(k); out.push(c); }
  }
  return out;
}

/* Older versions stored the name under `tag`; aliases may be missing. */
function migrateUsers(users) {
  return users.map(u => {
    const name = u.name || u.tag || "";
    return { rank: u.rank, name, aliases: Array.isArray(u.aliases) ? u.aliases : [] };
  });
}

const activeRaw = parseInt(read(KEYS.active), 10);

export const S = {
  users: migrateUsers(readJSON(KEYS.users, [])),
  activeIdx: isNaN(activeRaw) ? -1 : activeRaw,
  blocklist: readJSON(KEYS.blocklist, null) || dedupeBlocklist(DEFAULT_BLOCKLIST),
  theme: read(KEYS.theme) || "auto",
  autoGen: read(KEYS.autoGen) !== "off",
  trackerEnabled: read(KEYS.trackerEnabled) !== "off",
  tracker: readJSON(KEYS.tracker, []),
  notePresets: readJSON(KEYS.notePresets, null) || DEFAULT_NOTE_PRESETS.slice(),
  page: "deploy",
  dayOffset: 0,
};

export const activeUser = () => (S.activeIdx >= 0 && S.activeIdx < S.users.length ? S.users[S.activeIdx] : null);

export const save = {
  users() { write(KEYS.users, JSON.stringify(S.users)); write(KEYS.active, String(S.activeIdx)); },
  blocklist() { write(KEYS.blocklist, JSON.stringify(S.blocklist)); },
  theme() { write(KEYS.theme, S.theme); },
  autoGen() { write(KEYS.autoGen, S.autoGen ? "on" : "off"); },
  trackerEnabled() { write(KEYS.trackerEnabled, S.trackerEnabled ? "on" : "off"); },
  tracker() { write(KEYS.tracker, JSON.stringify(S.tracker)); },
  notePresets() { write(KEYS.notePresets, JSON.stringify(S.notePresets)); },
};

/* Backup: users, status codes and note presets (not the live tracker). */
export function exportBackup() {
  return JSON.stringify({
    app: "dispatch",
    version: 1,
    exportedAt: new Date().toISOString(),
    users: S.users,
    activeIdx: S.activeIdx,
    blocklist: S.blocklist,
    notePresets: S.notePresets,
  }, null, 2);
}

export function importBackup(json) {
  const data = JSON.parse(json);
  if (!data || data.app !== "dispatch" || !Array.isArray(data.users)) throw new Error("Not a Dispatch backup file");
  S.users = migrateUsers(data.users);
  S.activeIdx = Number.isInteger(data.activeIdx) && data.activeIdx < S.users.length ? data.activeIdx : (S.users.length ? 0 : -1);
  if (Array.isArray(data.blocklist)) S.blocklist = dedupeBlocklist(data.blocklist);
  if (Array.isArray(data.notePresets)) S.notePresets = data.notePresets.slice(0, 8);
  save.users();
  save.blocklist();
  save.notePresets();
}

save.users(); /* persist the migration */
