/* Update page: paste the latest list and tick off the vehicles done in the Tracker. */
import { S } from "../store.js";
import { applyStatusesToList } from "../lib/apply-statuses.js";
import { clearTracker, doneMap } from "../tracker/model.js";
import { renderTracker } from "../tracker/view.js";
import { $, setStatus, setMessages, setOutputText, getOutputText, wireCopyButton, toast } from "./dom.js";

const STATUS = { dot: "updateStatusDot", text: "updateStatusText", meta: "updateStatusMeta" };
const EMPTY = "Updated list appears here";

function reset() {
  $("updateInput").value = "";
  setOutputText($("updateOutput"), "", $("updateCopyBtn"), EMPTY);
  setMessages($("updateMessages"), []);
  setStatus(STATUS, "", "awaiting input", "—");
}

function apply() {
  const raw = $("updateInput").value.trim();
  const fail = (text, statusText) => {
    setMessages($("updateMessages"), [{ kind: "err", text }]);
    setStatus(STATUS, "err", statusText, "—");
    setOutputText($("updateOutput"), "", $("updateCopyBtn"), EMPTY);
  };
  if (!raw) return fail("Paste the latest list first.", "no input");
  const done = doneMap();
  if (done.size === 0) return fail("No completed vehicles in the Tracker yet.", "nothing to apply");

  const result = applyStatusesToList(raw, done);
  setOutputText($("updateOutput"), result.text, $("updateCopyBtn"), EMPTY);

  const msgs = [];
  if (result.replacedCount === 0) {
    msgs.push({ kind: "warn", text: "None of your completed MIDs are in the pasted list." });
  } else {
    msgs.push({ kind: "info", text: `Ticked ${result.replacedCount} of ${result.totalDone} completed vehicles.` });
    const missing = [...done.keys()].filter(mid => !raw.includes(mid));
    if (missing.length) msgs.push({ kind: "warn", text: `Not in pasted list: ${missing.join(", ")}` });
  }
  setMessages($("updateMessages"), msgs);
  setStatus(STATUS, result.replacedCount > 0 ? "ok" : "warn", result.replacedCount > 0 ? "ready" : "no match",
    `${result.replacedCount}/${result.totalDone} ticked`);
}

export function initUpdate() {
  $("applyBtn").addEventListener("click", apply);
  $("updateInput").addEventListener("paste", () => {
    if (!S.autoGen) return;
    setTimeout(() => { if ($("updateInput").value.trim() && doneMap().size) apply(); }, 30);
  });
  $("clearUpdateBtn").addEventListener("click", () => { $("updateInput").value = ""; $("updateInput").focus(); });

  /* Copying the finished list closes out the round: the tracker is cleared. */
  wireCopyButton($("updateCopyBtn"), () => getOutputText($("updateOutput")), () => {
    setTimeout(() => {
      clearTracker();
      renderTracker();
      reset();
      toast("Copied. Tracker cleared for the next round");
    }, 1100);
  });

  reset();
}
