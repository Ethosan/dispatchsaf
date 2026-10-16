/* Deploy page: paste the list, pick the day and start time, generate blocks. */
import { S, activeUser } from "../store.js";
import { parseDispatch } from "../lib/parser.js";
import { buildDispatchBlocks } from "../lib/schedule.js";
import { ddmmyy, dateWithOffset, minutesToHhmm, parseTimeInput } from "../lib/time.js";
import { syncToTracker } from "../tracker/model.js";
import { renderTracker } from "../tracker/view.js";
import { $, replay, setStatus, setMessages, setOutputBlocks, setOutputText, getOutputText, wireCopyButton } from "./dom.js";
import { openSettings } from "./settings.js";

const STATUS = { dot: "statusDot", text: "statusText", meta: "statusMeta" };
const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

function fail(text, statusText, meta = "—") {
  setMessages($("messages"), [{ kind: "err", text }]);
  setStatus(STATUS, "err", statusText, meta);
  setOutputText($("output"), "", $("copyBtn"));
}

export function updateDateShown() {
  $("datePickerShown").textContent = ddmmyy(dateWithOffset(S.dayOffset));
}

export function generate() {
  const raw = $("rawInput").value.trim();
  replay($("generateBtn"), "firing");

  const user = activeUser();
  if (!user) {
    fail("No active user. Tap the user card to set one.", "no user");
    openSettings("users");
    return;
  }
  if (!raw) return fail("Paste the vehicle list first.", "no input");

  let startOverride = null;
  const rawStart = $("timeOverride").value.trim();
  if (rawStart) {
    startOverride = parseTimeInput(rawStart);
    if (startOverride == null) return fail("Invalid start time. Use HHMM (e.g. 0840) or leave blank.", "bad time");
  }

  const parsed = parseDispatch(raw, S.blocklist);
  const date = ddmmyy(dateWithOffset(S.dayOffset));
  const result = buildDispatchBlocks(user, parsed, date, startOverride);

  if (result.total === 0) {
    setOutputText($("output"), "", $("copyBtn"));
    const tags = [...new Set([...parsed.WPT, ...parsed.MPT].map(v => v.tag).filter(Boolean))];
    const found = parsed.WPT.length + parsed.MPT.length;
    const msgs = [{ kind: "err", text: `No vehicles found for "${user.name.toUpperCase()}" in ${plural(found, "listed vehicle")}.` }];
    if (tags.length) msgs.push({ kind: "info", text: "Names in this list: " + tags.join(", ") + ". Add one as an alias in Settings if it is you." });
    setMessages($("messages"), msgs);
    setStatus(STATUS, "err", "no match", "0 vehicles");
    return;
  }

  if (S.trackerEnabled) {
    syncToTracker(result.allMatches);
    renderTracker();
  }

  const notes = [];
  if (result.wptOverflow > 0) notes.push({ kind: "warn", text: `${result.wptCount} WPT vehicles, over the soft cap of 5.` });
  if (result.embeddedCount > 0) notes.push({ kind: "info", text: `Used the time written on the list for ${result.embeddedCount} of ${plural(result.total, "vehicle")}.` });
  notes.push({ kind: "info", text: `Slots ${minutesToHhmm(result.startMin)} to ${minutesToHhmm(result.endMin)}` + (startOverride != null ? " (custom start)" : "") + (S.dayOffset === 1 ? `, tomorrow ${date}` : "") + "." });
  if (S.trackerEnabled) notes.push({ kind: "info", text: `Synced ${plural(result.total, "vehicle")} to Tracker.` });

  setMessages($("messages"), notes);
  setOutputBlocks($("output"), result.blocks, $("copyBtn"));
  setStatus(STATUS, result.wptOverflow > 0 ? "warn" : "ok", result.wptOverflow > 0 ? "ready (check)" : "ready",
    `${result.wptCount} WPT · ${result.mptCount} MPT`);
}

export function initDeploy() {
  $("generateBtn").addEventListener("click", generate);

  $("rawInput").addEventListener("paste", () => {
    if (!S.autoGen) return;
    setTimeout(() => { if ($("rawInput").value.trim() && activeUser()) generate(); }, 30);
  });
  /* Ctrl/Cmd+Enter generates from the textarea. */
  $("rawInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); }
  });

  const setTimeLabel = v => {
    $("timeReset").classList.toggle("show", !!v);
    $("timeLabel").textContent = v ? "Start (custom)" : "Start (default)";
  };
  $("timeOverride").addEventListener("input", e => {
    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
    e.target.value = v;
    setTimeLabel(v);
  });
  $("timeReset").addEventListener("click", e => {
    e.preventDefault();
    $("timeOverride").value = "";
    setTimeLabel("");
  });

  document.querySelectorAll("#dateSeg button").forEach(b => {
    b.addEventListener("click", () => {
      S.dayOffset = parseInt(b.dataset.day, 10) || 0;
      document.querySelectorAll("#dateSeg button").forEach(x => {
        const on = x === b;
        x.classList.toggle("active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      updateDateShown();
    });
  });

  wireCopyButton($("copyBtn"), () => getOutputText($("output")));

  $("clearOutBtn").addEventListener("click", () => {
    setOutputText($("output"), "", $("copyBtn"));
    setMessages($("messages"), []);
    setStatus(STATUS, "", "awaiting input", "—");
  });
  $("clearRawBtn").addEventListener("click", () => { $("rawInput").value = ""; $("rawInput").focus(); });

  setStatus(STATUS, "", "awaiting input", "—");
  updateDateShown();
}
