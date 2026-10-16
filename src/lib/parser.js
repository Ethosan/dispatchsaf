/* Parser for the WPT / MPT vehicle list as it is pasted from chat.
   The list is messy: emoji ticks, vehicles run together on one line, category
   headers inline. Everything is normalized to one vehicle per line first. */

/* Vehicle category headers that appear in the list. Add new ones here. */
export const CATEGORY_SOURCES = [
  "5 Ton (?:CP|GS)(?: \\(Auto\\))?",
  "5 Ton Skid Tanker(?: \\(Auto\\))?",
  "6 Ton (?:CP|GS)(?: \\(Auto\\))?",
  "Ford Everest OUV(?: \\(Auto\\))?",
  "AGILIS(?: \\(Auto W\\/TES\\))?",
  "AUTOBOT",
  "VAMTAC SATCOM Shelter",
  "VAMTAC Fams",
  "GP Car(?: \\(Auto\\))?",
  "Recce Bike(?: \\(Yamaha\\))?",
  "Trailer Cargo 1\\.5 Ton",
  "HMCT 8 Wheeler",
  "MUV Amb",
  "F550 Combat Ambulance",
];

/* Matches any category header (used by the Update page to find line boundaries). */
export const categoryHeaderRegex = () => new RegExp("(?:" + CATEGORY_SOURCES.join("|") + ")", "g");

/* A five-digit vehicle MID that is not part of a longer number. */
export const midRegex = () => /(?<!\d)(\d{5})(?!\d)/g;

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* An HHMM-HHMM time range on a vehicle line. Returns { match, startMin, endMin } or null. */
export function extractEmbeddedTime(rest) {
  if (!rest) return null;
  const m = /(\d{4})\s*[-–—]\s*(\d{4})/.exec(rest);
  if (!m) return null;
  const sH = parseInt(m[1].slice(0, 2), 10), sM = parseInt(m[1].slice(2, 4), 10);
  const eH = parseInt(m[2].slice(0, 2), 10), eM = parseInt(m[2].slice(2, 4), 10);
  if (sH > 23 || sM > 59 || eH > 23 || eM > 59) return null;
  return { match: m[0], startMin: sH * 60 + sM, endMin: eH * 60 + eM };
}

/* The first word after a MID that is not a known status code: usually a name. */
export function extractTag(rest, blocklist) {
  if (!rest) return null;
  let cleaned = rest.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const sorted = blocklist.slice().sort((a, b) => b.length - a.length);
  for (const code of sorted) {
    cleaned = cleaned.replace(new RegExp("\\b" + escapeRe(code) + "\\b", "gi"), " ");
  }
  cleaned = cleaned.replace(/\b(detail|driveback|route\s*ori|d\/b|t-loan(?:\s*to\s*sgn)?)\s+\d{1,2}\/\d{1,2}\b/gi, " ");
  cleaned = cleaned.replace(/\b(detail|driveback|route\s*ori|d\/b|t-loan)\b/gi, " ");
  cleaned = cleaned.replace(/\b\d{1,2}\/\d{1,2}\b/g, " ");
  cleaned = cleaned.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const first = cleaned.split(/\s+/)[0];
  if (!first || /^\d+$/.test(first)) return null;
  return first;
}

/* Parse a pasted list into { WPT: [...], MPT: [...] }.
   Each vehicle: { mid, category, rawRest, tag, embeddedTime }. */
export function parseDispatch(raw, blocklist = []) {
  let text = raw
    .replace(/[✅❌✔✖☑☒]/g, " ")
    .replace(/️/g, " ")
    .replace(/={3,}/g, "\n===\n")
    .replace(/\r\n/g, "\n");

  text = text.replace(/(?<!\d)(\d{5})(?!\d)/g, "\n$1 ");
  for (const src of CATEGORY_SOURCES) text = text.replace(new RegExp("(" + src + ")", "g"), "\n$1\n");
  text = text.replace(/\b(WPT|MPT)\b/g, "\n$1\n");

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const result = { WPT: [], MPT: [] };
  let section = null, category = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "WPT" || upper === "MPT") { section = upper; category = null; continue; }
    if (line === "===") continue;

    const midMatch = line.match(/^(\d{5})(?:\s+(.*))?$/);
    if (midMatch) {
      let rest = (midMatch[2] || "").trim();
      const embeddedTime = extractEmbeddedTime(rest);
      if (embeddedTime) rest = rest.replace(embeddedTime.match, " ").replace(/\s+/g, " ").trim();
      if (section) {
        result[section].push({
          mid: midMatch[1],
          category,
          rawRest: rest,
          tag: extractTag(rest, blocklist),
          embeddedTime: embeddedTime ? { startMin: embeddedTime.startMin, endMin: embeddedTime.endMin } : null,
        });
      }
      continue;
    }
    if (/[A-Za-z]/.test(line)) category = line;
  }
  return result;
}

/* True if the vehicle line mentions the user's name or one of their aliases as a whole word. */
export function matchesUser(vehicle, user) {
  if (!vehicle.rawRest) return false;
  const tokens = new Set([user.name.toLowerCase()]);
  for (const a of user.aliases || []) {
    const t = String(a || "").trim().toLowerCase();
    if (t) tokens.add(t);
  }
  const rest = vehicle.rawRest.toLowerCase().trim();
  for (const t of tokens) {
    if (new RegExp("(?:^|\\W)" + escapeRe(t) + "(?:\\W|$)", "i").test(rest)) return true;
  }
  return false;
}
