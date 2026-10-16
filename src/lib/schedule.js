/* Turns the user's vehicles into dispatch blocks with time slots.
   Rules:
   - Default start 0840, or the override from the Start box
   - WPT slot 20 min, MPT slot 30 min, WPTs first
   - 5 min buffer between consecutive slots
   - A time range written on the vehicle's line wins over the computed slot
   - More than 5 WPT is allowed but flagged */
import { matchesUser } from "./parser.js";
import { ddmmyy, hhmm, dateAtMinutesOfDay } from "./time.js";

export const WPT_DURATION_MIN = 20;
export const MPT_DURATION_MIN = 30;
export const SLOT_BUFFER_MIN = 5;
export const DEFAULT_START_MIN = 8 * 60 + 40;
export const WPT_SOFT_CAP = 5;

export function formatBlock({ date, start, end, mid, user, purpose }) {
  return [
    `DATE: ${date}`,
    `TIME: ${hhmm(start)}-${hhmm(end)}`,
    `MID: ${mid}`,
    `TO: ${user.rank} ${user.name.toUpperCase()}`,
    "VC: -",
    "LOCATION: KHC- KHC",
    `PURPOSE: ${purpose}`,
  ].join("\n");
}

export function buildDispatchBlocks(user, vehicles, dateOverride, startMinOverride, now = new Date()) {
  const date = dateOverride || ddmmyy(now);
  const wpt = vehicles.WPT.filter(v => matchesUser(v, user));
  const mpt = vehicles.MPT.filter(v => matchesUser(v, user));
  const startMin = startMinOverride != null ? startMinOverride : DEFAULT_START_MIN;

  const all = [
    ...wpt.map(v => ({ ...v, purpose: "WPT" })),
    ...mpt.map(v => ({ ...v, purpose: "MPT" })),
  ];

  const blocks = [];
  let cursor = startMin;
  let embeddedCount = 0;
  all.forEach((v, i) => {
    const dur = v.purpose === "WPT" ? WPT_DURATION_MIN : MPT_DURATION_MIN;
    let slotStart = cursor, slotEnd = cursor + dur;
    if (v.embeddedTime) {
      slotStart = v.embeddedTime.startMin;
      slotEnd = v.embeddedTime.endMin;
      embeddedCount++;
    }
    const start = dateAtMinutesOfDay(now, slotStart);
    const end = dateAtMinutesOfDay(now, slotEnd);
    blocks.push({
      text: formatBlock({ date, start, end, mid: v.mid, user, purpose: v.purpose }),
      mid: v.mid,
      category: v.category,
      purpose: v.purpose,
      startMin: slotStart,
      endMin: slotEnd,
    });
    cursor = slotEnd + (i < all.length - 1 ? SLOT_BUFFER_MIN : 0);
  });

  return {
    blocks,
    wptCount: wpt.length,
    mptCount: mpt.length,
    wptOverflow: Math.max(0, wpt.length - WPT_SOFT_CAP),
    startMin,
    endMin: blocks.length ? blocks[blocks.length - 1].endMin : startMin,
    embeddedCount,
    total: all.length,
    allMatches: all,
  };
}
