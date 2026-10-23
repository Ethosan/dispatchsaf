// ─── Dispatch block formatting ──────────────────────────────────────────────

import type { DispatchBlock, GenerateResult, ParsedVehicle, Purpose, TrackedVehicle, User, VehicleList } from '../types';
import { formatTimeHM, setTimeOnDate } from './time';
import { vehicleMatchesUser } from './parse';

// Duration defaults (minutes)
const WPT_DURATION = 20;
const MPT_DURATION = 30;
const GAP_BETWEEN = 5;
const DEFAULT_START = 520; // 08:40
const WPT_SOFT_CAP = 5;

/** Build a single dispatch block text. */
function buildBlockText(params: {
  date: string;
  start: Date;
  end: Date;
  mid: string;
  user: User;
  purpose: Purpose;
}): string {
  const { date, start, end, mid, user, purpose } = params;
  return [
    `DATE: ${date}`,
    `TIME: ${formatTimeHM(start)}-${formatTimeHM(end)}`,
    `MID: ${mid}`,
    `TO: ${user.rank} ${user.name.toUpperCase()}`,
    'VC: -',
    'LOCATION: KHC- KHC',
    `PURPOSE: ${purpose}`,
  ].join('\n');
}

/**
 * Generate dispatch blocks for a user from a parsed vehicle list.
 *
 * @param user       The active user
 * @param list       Parsed WPT/MPT vehicle list
 * @param dateStr    Date string (DDMMYY)
 * @param startOverride  Custom start time in minutes (null = default 08:40)
 * @param now        Reference date (for time calculations)
 */
export function generateDispatch(
  user: User,
  list: VehicleList,
  dateStr: string,
  startOverride: number | null = null,
  now: Date = new Date()
): GenerateResult {
  const wptMatches = list.WPT.filter(v => vehicleMatchesUser(v, user));
  const mptMatches = list.MPT.filter(v => vehicleMatchesUser(v, user));

  const startMin = startOverride ?? DEFAULT_START;

  const allMatches: Array<ParsedVehicle & { purpose: Purpose }> = [
    ...wptMatches.map(v => ({ ...v, purpose: 'WPT' as const })),
    ...mptMatches.map(v => ({ ...v, purpose: 'MPT' as const })),
  ];

  const blocks: DispatchBlock[] = [];
  let cursor = startMin;
  let embeddedCount = 0;

  allMatches.forEach((vehicle, idx) => {
    const duration = vehicle.purpose === 'WPT' ? WPT_DURATION : MPT_DURATION;
    let blockStart = cursor;
    let blockEnd = cursor + duration;

    if (vehicle.embeddedTime) {
      blockStart = vehicle.embeddedTime.startMin;
      blockEnd = vehicle.embeddedTime.endMin;
      embeddedCount++;
    }

    const startDate = setTimeOnDate(now, blockStart);
    const endDate = setTimeOnDate(now, blockEnd);

    blocks.push({
      text: buildBlockText({
        date: dateStr,
        start: startDate,
        end: endDate,
        mid: vehicle.mid,
        user,
        purpose: vehicle.purpose,
      }),
      mid: vehicle.mid,
      category: vehicle.category,
      purpose: vehicle.purpose,
      startMin: blockStart,
      endMin: blockEnd,
    });

    cursor = blockEnd + (idx < allMatches.length - 1 ? GAP_BETWEEN : 0);
  });

  const trackedVehicles: TrackedVehicle[] = allMatches.map(v => ({
    mid: v.mid,
    category: v.category || '',
    purpose: v.purpose,
    status: 'pending',
    note: '',
    timer: { state: 'idle', startedAt: null, accumulated: 0 },
  }));

  return {
    blocks,
    wptCount: wptMatches.length,
    mptCount: mptMatches.length,
    wptOverflow: Math.max(0, wptMatches.length - WPT_SOFT_CAP),
    startMin,
    endMin: blocks.length > 0 ? blocks[blocks.length - 1].endMin : startMin,
    embeddedCount,
    total: allMatches.length,
    allMatches: trackedVehicles,
  };
}

/** Pluralise helper: "1 vehicle" / "3 vehicles". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
