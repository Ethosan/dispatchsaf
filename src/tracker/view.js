import { S } from "../store.js";
import { pad } from "../lib/time.js";
import { $, escapeHtml, replay, toast, vibrate } from "../ui/dom.js";
import * as T from "./model.js";

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  x: '<svg class="icon-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};

export function formatTimer(ms) {
  const sec = Math.ceil(ms / 1000);
  return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
}

const cardFor = mid => document.querySelector(`.veh-card[data-mid="${mid}"]`);

function flash(mid) {
  const card = cardFor(mid);
  if (card) replay(card, "complete-flash");
}

function vehicleCard(v, hasTimer) {
  const card = document.createElement("div");
  card.className = "veh-card" + (v.status === "done" ? " done" : "") + (v.timer.state === "running" ? " running" : "");
  card.dataset.mid = v.mid;

  const timer = hasTimer ? `
    <div class="veh-timer">
      <span class="timer-display" role="timer" aria-label="Time left">${formatTimer(T.timerRemaining(v))}</span>
      ${v.timer.state === "running"
        ? `<button class="timer-btn pause" data-action="pause" aria-label="Pause timer for ${v.mid}">${ICON.pause}</button>`
        : `<button class="timer-btn" data-action="start" aria-label="Start timer for ${v.mid}" ${v.timer.state === "done" ? "disabled" : ""}>${ICON.play}</button>`}
      <button class="timer-btn reset" data-action="reset" aria-label="Reset timer for ${v.mid}">${ICON.reset}</button>
    </div>` : "";

  card.innerHTML = `
    <div class="veh-row">
      <button class="veh-status-toggle ${v.status === "done" ? "done" : ""}" data-action="toggle"
        aria-pressed="${v.status === "done"}" aria-label="Mark ${v.mid} done">${ICON.x}${ICON.check}</button>
      <div class="veh-mid">${v.mid}</div>
      <div class="veh-meta"><div class="veh-cat">${escapeHtml(v.category || "—")}</div></div>
      ${timer}
    </div>
    <div class="veh-note-row">
      <div class="note-input-wrap">
        <input type="text" class="note-input" data-mid="${v.mid}" aria-label="Note for ${v.mid}"
          placeholder="optional note (e.g. cannot hold charge)" value="${escapeHtml(v.note || "")}" autocomplete="off">
        <button class="note-presets-btn" data-action="presets" aria-label="Saved notes" aria-haspopup="menu">▾</button>
        <div class="preset-popup" role="menu" data-popup-for="${v.mid}"></div>
      </div>
    </div>`;
  return card;
}

export function renderTracker() {
  const list = $("trackerList");
  const groups = [["WPT", true], ["MPT", false]];
  const nodes = [];
  for (const [purpose, hasTimer] of groups) {
    const vs = S.tracker.filter(v => v.purpose === purpose);
    if (!vs.length) continue;
    const lbl = document.createElement("h2");
    lbl.className = "section-label";
    lbl.textContent = purpose;
    nodes.push(lbl, ...vs.map(v => vehicleCard(v, hasTimer)));
  }
  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "No vehicles yet.<br>Generate a dispatch on the Deploy tab and your vehicles appear here.";
    nodes.push(empty);
  }
  list.replaceChildren(...nodes);
  renderSummary();
}

export function renderSummary() {
  const c = T.counts();
  $("trackerWptDone").textContent = c.wptDone;
  $("trackerWptTotal").textContent = c.wptTotal;
  $("trackerMptDone").textContent = c.mptDone;
  $("trackerMptTotal").textContent = c.mptTotal;
  $("trackerRunningCount").textContent = c.running;
  $("updateCount").textContent = c.done === 0 ? "No completed vehicles yet" : c.done + " vehicle" + (c.done === 1 ? "" : "s") + " ready";

  const badge = $("trackerBadge");
  badge.hidden = c.total === 0;
  badge.className = "tab-badge " + (c.running ? "running" : c.pending ? "pending" : "complete");
  badge.textContent = c.running || c.pending || "✓";
}

function showPresets(mid) {
  document.querySelectorAll(".preset-popup").forEach(p => p.classList.remove("show"));
  const popup = document.querySelector(`.preset-popup[data-popup-for="${mid}"]`);
  if (!popup) return;
  const input = document.querySelector(`.note-input[data-mid="${mid}"]`);
  const pick = note => {
    T.setNote(mid, note);
    if (input) input.value = note;
    if (note) T.rememberPreset(note);
    popup.classList.remove("show");
  };

  const none = document.createElement("button");
  none.type = "button";
  none.className = "preset-item empty";
  none.setAttribute("role", "menuitem");
  none.textContent = "(none)";
  none.addEventListener("click", e => { e.stopPropagation(); pick(""); });

  const items = S.notePresets.map((preset, idx) => {
    const row = document.createElement("div");
    row.className = "preset-item";
    row.innerHTML = `<button type="button" role="menuitem">${escapeHtml(preset)}</button><button type="button" class="preset-x" aria-label="Delete saved note">×</button>`;
    row.firstChild.addEventListener("click", e => { e.stopPropagation(); pick(preset); });
    row.lastChild.addEventListener("click", e => { e.stopPropagation(); T.deletePreset(idx); showPresets(mid); });
    return row;
  });

  popup.replaceChildren(none, ...items);
  popup.classList.add("show");
}

export function initTracker() {
  const list = $("trackerList");

  /* One delegated listener for every card button. */
  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const mid = btn.closest(".veh-card")?.dataset.mid;
    if (!mid) return;
    e.stopPropagation();
    switch (btn.dataset.action) {
      case "toggle":
        if (T.toggleStatus(mid) === "done") { vibrate(20); renderTracker(); flash(mid); return; }
        break;
      case "start": T.startTimer(mid); break;
      case "pause": T.pauseTimer(mid); break;
      case "reset": T.resetTimer(mid); break;
      case "presets": showPresets(mid); return;
    }
    renderTracker();
  });

  list.addEventListener("input", e => {
    if (e.target.matches(".note-input")) {
      T.setNote(e.target.dataset.mid, e.target.value);
      renderSummary();
    }
  });
  list.addEventListener("focusout", e => {
    if (e.target.matches(".note-input")) T.rememberPreset(e.target.value);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".note-input-wrap")) document.querySelectorAll(".preset-popup").forEach(p => p.classList.remove("show"));
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".preset-popup.show").forEach(p => p.classList.remove("show"));
  });

  setInterval(() => {
    const finished = T.tick();
    if (finished.length) {
      renderTracker();
      finished.forEach(flash);
      vibrate([120, 80, 120]);
      toast(finished.length === 1 ? `${finished[0]} timer done` : `${finished.length} timers done`);
      return;
    }
    for (const v of S.tracker) {
      if (v.timer.state !== "running") continue;
      const el = cardFor(v.mid)?.querySelector(".timer-display");
      if (el) el.textContent = formatTimer(T.timerRemaining(v));
    }
    $("trackerRunningCount").textContent = T.counts().running;
  }, 1000);
}
