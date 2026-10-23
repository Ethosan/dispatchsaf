// ─── Vehicle list parsing ───────────────────────────────────────────────────

import type { ParsedVehicle, Purpose, User, VehicleList } from '../types';

// Vehicle categories that contain spaces — used to split lines intelligently.
const VEHICLE_CATEGORIES: string[] = [
  '5 Ton (?:CP|GS)(?: \\(Auto\\))?',
  '5 Ton Skid Tanker(?: \\(Auto\\))?',
  '6 Ton (?:CP|GS)(?: \\(Auto\\))?',
  'Ford Everest OUV(?: \\(Auto\\))?',
  'AGILIS(?: \\(Auto W\\/TES\\))?',
  'AUTOBOT',
  'VAMTAC SATCOM Shelter',
  'VAMTAC Fams',
  'GP Car(?: \\(Auto\\))?',
  'Recce Bike(?: \\(Yamaha\\))?',
  'Trailer Cargo 1\\.5 Ton',
  'HMCT 8 Wheeler',
  'MUV Amb',
  'F550 Combat Ambulance',
];

function midRegex(): RegExp {
  return /(?<!\d)(\d{5})(?!\d)/g;
}

/** Escape a string for use in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a time range like "0800 - 0900" from a string.
 * Returns { match, startMin, endMin } or null.
 */
export function parseTimeRange(text: string): { match: string; startMin: number; endMin: number } | null {
  const m = /(\d{4})\s*[-–—]\s*(\d{4})/.exec(text);
  if (!m) return null;
  const h1 = parseInt(m[1].slice(0, 2), 10);
  const m1 = parseInt(m[1].slice(2, 4), 10);
  const h2 = parseInt(m[2].slice(0, 2), 10);
  const m2 = parseInt(m[2].slice(2, 4), 10);
  if (h1 > 23 || m1 > 59 || h2 > 23 || m2 > 59) return null;
  return { match: m[0], startMin: h1 * 60 + m1, endMin: h2 * 60 + m2 };
}

/**
 * Extract a person's name/tag from the rest of a vehicle line.
 * Strips out blocklisted status codes, time ranges, and common noise words.
 */
export function extractTag(rest: string, blocklist: string[]): string | null {
  if (!rest) return null;

  // Remove parenthesised and bracketed content
  let text = rest.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');

  // Remove blocklisted status codes (longest first to avoid partial matches)
  const sorted = [...blocklist].sort((a, b) => b.length - a.length);
  for (const code of sorted) {
    text = text.replace(new RegExp(`\\b${escapeRegex(code)}\\b`, 'gi'), ' ');
  }

  // Remove common noise phrases
  text = text.replace(/\b(detail|driveback|route\s*ori|d\/b|t-loan(?:\s*to\s*sgn)?)\s+\d{1,2}\/\d{1,2}\b/gi, ' ');
  text = text.replace(/\b(detail|driveback|route\s*ori|d\/b|t-loan)\b/gi, ' ');
  text = text.replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ');

  // Clean up
  text = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const firstWord = text.split(/\s+/)[0];
  if (!firstWord || /^\d+$/.test(firstWord)) return null;
  return firstWord;
}

/**
 * Parse a raw WPT/MPT vehicle list into structured data.
 * Handles MIDs (5-digit numbers), vehicle categories, time ranges, and names.
 */
export function parseVehicleList(raw: string): VehicleList {
  // Normalise: strip emoji markers, unify line endings, add line breaks before MIDs/categories/purposes
  let text = raw
    .replace(/[✅❌✔✖☑☒]/g, ' ')
    .replace(/️/g, ' ')
    .replace(/={3,}/g, '\n===\n')
    .replace(/\r\n/g, '\n');

  // Insert line breaks before 5-digit MIDs
  text = text.replace(midRegex(), '\n$1 ');

  // Insert line breaks before vehicle categories
  for (const cat of VEHICLE_CATEGORIES) {
    text = text.replace(new RegExp(`(${cat})`, 'g'), '\n$1');
  }

  // Insert line breaks before WPT/MPT markers
  text = text.replace(/\b(WPT|MPT)\b/g, '\n$1');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: VehicleList = { WPT: [], MPT: [] };

  let currentPurpose: Purpose | null = null;
  let currentCategory: string | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();

    // Purpose header
    if (upper === 'WPT' || upper === 'MPT') {
      currentPurpose = upper;
      currentCategory = null;
      continue;
    }

    // Separator
    if (line === '===') continue;

    // MID line: starts with a 5-digit number
    const midMatch = line.match(/^(\d{5})(?:\s+(.*))?$/);
    if (midMatch) {
      let rest = (midMatch[2] || '').trim();

      // Extract embedded time range
      const timeRange = parseTimeRange(rest);
      if (timeRange) {
        rest = rest.replace(timeRange.match, ' ').replace(/\s+/g, ' ').trim();
      }

      if (currentPurpose) {
        result[currentPurpose].push({
          mid: midMatch[1],
          category: currentCategory,
          rawRest: rest,
          tag: extractTag(rest, []), // tag extracted later with blocklist
          embeddedTime: timeRange
            ? { startMin: timeRange.startMin, endMin: timeRange.endMin }
            : null,
        });
      }
      continue;
    }

    // Category line: contains letters (not a MID, not a purpose header)
    if (/[A-Za-z]/.test(line)) {
      currentCategory = line;
    }
  }

  return result;
}

/**
 * Re-extract tags for all vehicles using the full blocklist.
 * Call this after parseVehicleList to get accurate tags.
 */
export function extractTags(list: VehicleList, blocklist: string[]): VehicleList {
  for (const purpose of ['WPT', 'MPT'] as const) {
    for (const vehicle of list[purpose]) {
      vehicle.tag = extractTag(vehicle.rawRest, blocklist);
    }
  }
  return list;
}

/**
 * Check if a parsed vehicle belongs to the given user (by name or alias).
 */
export function vehicleMatchesUser(vehicle: ParsedVehicle, user: User): boolean {
  if (!vehicle.rawRest) return false;

  const names = new Set([user.name.toLowerCase()]);
  for (const alias of user.aliases || []) {
    const trimmed = String(alias || '').trim().toLowerCase();
    if (trimmed) names.add(trimmed);
  }

  const rest = vehicle.rawRest.toLowerCase().trim();
  for (const name of names) {
    if (new RegExp(`(?:^|\\W)${escapeRegex(name)}(?:\\W|$)`, 'i').test(rest)) {
      return true;
    }
  }
  return false;
}
