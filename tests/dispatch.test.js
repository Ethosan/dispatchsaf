import { describe, expect, it } from "vitest";
import { parseDispatch, extractTag, extractEmbeddedTime, matchesUser } from "../src/lib/parser.js";
import { buildDispatchBlocks } from "../src/lib/schedule.js";
import { applyStatusesToList } from "../src/lib/apply-statuses.js";
import { parseTimeInput, ddmmyy } from "../src/lib/time.js";

const BLOCKLIST = ["VOR", "NO KEY", "cannot hold charge", "KIV", "AUTOBOT"];
const ETHAN = { rank: "CPL", name: "Ethan", aliases: ["ET"] };

const LIST = `WPT
5 Ton GS (Auto)
12345 Ethan
23456 VOR
34567 Joshua Goh
GP Car (Auto)
45678 ET 1000-1020
MPT
Ford Everest OUV
56789 ethan ✅
67890 NO KEY`;

describe("parseDispatch", () => {
  it("splits sections, categories and vehicles", () => {
    const r = parseDispatch(LIST, BLOCKLIST);
    expect(r.WPT.map(v => v.mid)).toEqual(["12345", "23456", "34567", "45678"]);
    expect(r.MPT.map(v => v.mid)).toEqual(["56789", "67890"]);
    expect(r.WPT[0].category).toBe("5 Ton GS (Auto)");
    expect(r.WPT[3].category).toBe("GP Car (Auto)");
    expect(r.MPT[0].category).toBe("Ford Everest OUV");
  });

  it("handles a list pasted as one run-on line", () => {
    const r = parseDispatch("WPT 5 Ton GS (Auto) 12345 Ethan 23456 VOR MPT GP Car 34567 Ethan", BLOCKLIST);
    expect(r.WPT.map(v => v.mid)).toEqual(["12345", "23456"]);
    expect(r.MPT.map(v => v.mid)).toEqual(["34567"]);
    expect(r.MPT[0].category).toBe("GP Car");
  });

  it("reads tags, skipping status codes", () => {
    const r = parseDispatch(LIST, BLOCKLIST);
    expect(r.WPT[0].tag).toBe("Ethan");
    expect(r.WPT[1].tag).toBeNull();
    expect(r.WPT[2].tag).toBe("Joshua");
  });

  it("pulls an embedded time range off the line", () => {
    const v = parseDispatch(LIST, BLOCKLIST).WPT[3];
    expect(v.embeddedTime).toEqual({ startMin: 600, endMin: 620 });
    expect(v.rawRest).toBe("ET");
  });

  it("ignores vehicles before any section header", () => {
    const r = parseDispatch("12345 Ethan\nWPT\n23456 Ethan", BLOCKLIST);
    expect(r.WPT.map(v => v.mid)).toEqual(["23456"]);
  });

  it("does not treat 6-digit numbers as MIDs", () => {
    const r = parseDispatch("WPT\n123456 Ethan", BLOCKLIST);
    expect(r.WPT).toEqual([]);
  });
});

describe("helpers", () => {
  it("extractTag drops bracketed text, dates and codes", () => {
    expect(extractTag("(spare) KIV 12/3 Ethan", BLOCKLIST)).toBe("Ethan");
    expect(extractTag("cannot hold charge", BLOCKLIST)).toBeNull();
  });

  it("extractEmbeddedTime rejects impossible times", () => {
    expect(extractEmbeddedTime("2500-2600")).toBeNull();
    expect(extractEmbeddedTime("0840–0900")).toMatchObject({ startMin: 520, endMin: 540 });
  });

  it("matchesUser uses whole words and aliases", () => {
    expect(matchesUser({ rawRest: "Ethan" }, ETHAN)).toBe(true);
    expect(matchesUser({ rawRest: "ET" }, ETHAN)).toBe(true);
    expect(matchesUser({ rawRest: "Ethanol" }, ETHAN)).toBe(false);
    expect(matchesUser({ rawRest: "Joshua Goh" }, { name: "Joshua Goh", aliases: [] })).toBe(true);
  });

  it("parseTimeInput accepts common forms", () => {
    expect(parseTimeInput("0840")).toBe(520);
    expect(parseTimeInput("840")).toBe(520);
    expect(parseTimeInput("08:40")).toBe(520);
    expect(parseTimeInput("2460")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
  });

  it("ddmmyy formats day first", () => {
    expect(ddmmyy(new Date(2026, 9, 6))).toBe("061026");
  });
});

describe("buildDispatchBlocks", () => {
  const parsed = parseDispatch(LIST, BLOCKLIST);
  const now = new Date(2026, 9, 16, 7, 0);

  it("schedules WPT then MPT with 5-minute buffers from 0840", () => {
    const r = buildDispatchBlocks(ETHAN, parsed, "161026", null, now);
    expect(r.wptCount).toBe(2);
    expect(r.mptCount).toBe(1);
    expect(r.blocks.map(b => b.text.split("\n")[1])).toEqual([
      "TIME: 0840-0900",
      "TIME: 1000-1020", /* embedded time wins */
      "TIME: 1025-1055", /* MPT: 30 min after the 5-min buffer */
    ]);
  });

  it("formats each block exactly", () => {
    const r = buildDispatchBlocks(ETHAN, parsed, "161026", null, now);
    expect(r.blocks[0].text).toBe([
      "DATE: 161026",
      "TIME: 0840-0900",
      "MID: 12345",
      "TO: CPL ETHAN",
      "VC: -",
      "LOCATION: KHC- KHC",
      "PURPOSE: WPT",
    ].join("\n"));
  });

  it("honours a custom start time", () => {
    const r = buildDispatchBlocks(ETHAN, parsed, "161026", 13 * 60, now);
    expect(r.blocks[0].text).toContain("TIME: 1300-1320");
  });

  it("flags more than five WPT", () => {
    const many = "WPT\n" + Array.from({ length: 7 }, (_, i) => `1000${i} Ethan`).join("\n");
    const r = buildDispatchBlocks(ETHAN, parseDispatch(many, BLOCKLIST), "161026", null, now);
    expect(r.wptCount).toBe(7);
    expect(r.wptOverflow).toBe(2);
  });
});

describe("applyStatusesToList", () => {
  it("ticks completed MIDs and leaves the rest untouched", () => {
    const done = new Map([["12345", ""], ["56789", "cannot hold charge"]]);
    const r = applyStatusesToList(LIST, done);
    expect(r.replacedCount).toBe(2);
    expect(r.text).toContain("12345 ✅\n23456 VOR");
    expect(r.text).toContain("56789 ✅ cannot hold charge\n67890 NO KEY");
    expect(r.text.split("\n").length).toBe(LIST.split("\n").length);
  });

  it("stops at the next MID on a run-on line", () => {
    const r = applyStatusesToList("WPT 12345 Ethan 23456 VOR", new Map([["12345", ""]]));
    expect(r.text).toBe("WPT 12345 ✅ 23456 VOR");
  });

  it("returns the input when nothing is done", () => {
    expect(applyStatusesToList(LIST, new Map()).text).toBe(LIST);
  });
});
