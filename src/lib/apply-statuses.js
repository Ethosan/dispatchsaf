/* Update page: in the latest list, replace the trailing tag after each completed
   vehicle's MID with a tick and its note, leaving every other byte as it was. */
import { categoryHeaderRegex, midRegex } from "./parser.js";

const TICK = "✅";

/* done: Map of MID -> note for vehicles marked done. */
export function applyStatusesToList(rawList, done) {
  if (done.size === 0) return { text: rawList, replacedCount: 0, totalDone: 0 };

  /* Positions the tag after a MID must not run past: the next MID,
     a category header, or a WPT/MPT section marker. */
  const boundaries = [];
  for (const re of [midRegex(), categoryHeaderRegex(), /\b(?:WPT|MPT)\b/g]) {
    let m;
    while ((m = re.exec(rawList)) !== null) boundaries.push(m.index);
  }
  boundaries.sort((a, b) => a - b);

  const mids = [];
  const re = midRegex();
  let m;
  while ((m = re.exec(rawList)) !== null) mids.push({ mid: m[1], end: m.index + 5 });

  let out = "";
  let cursor = 0;
  let replacedCount = 0;
  for (const cur of mids) {
    let boundary = rawList.length;
    const nl = rawList.indexOf("\n", cur.end);
    if (nl !== -1) boundary = nl;
    for (const b of boundaries) {
      if (b > cur.end && b < boundary) { boundary = b; break; }
    }
    out += rawList.slice(cursor, cur.end);
    if (done.has(cur.mid)) {
      const note = done.get(cur.mid);
      /* Keep the whitespace that separated the old tag from whatever follows
         (on a run-on line, that is the space before the next MID). */
      const gap = rawList.slice(cur.end, boundary).match(/\s*$/)[0];
      out += (note ? ` ${TICK} ${note}` : ` ${TICK}`) + gap;
      replacedCount++;
    } else {
      out += rawList.slice(cur.end, boundary);
    }
    cursor = boundary;
  }
  out += rawList.slice(cursor);
  return { text: out, replacedCount, totalDone: done.size };
}
