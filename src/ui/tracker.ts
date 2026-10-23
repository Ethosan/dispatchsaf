// ─── Tracker page UI ────────────────────────────────────────────────────────

import type { AppState, TrackedVehicle } from '../types';
import { persist } from '../lib/state';
import {
  timeRemaining,
  startTimer,
  pauseTimer,
  resetTimer,
  toggleDone,
  tickTimers,
  summarizeTracker,
  addNotePreset,
  removeNotePreset,
} from '../lib/tracker';
import { formatCountdown } from '../lib/time';
import { el, escapeHtml, showToast, showConfirm, haptic, retriggerAnimation } from '../lib/dom';

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  x: '<svg class="icon-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};

// ─── Vehicle card ───────────────────────────────────────────────────────────

function findVehicle(state: AppState, mid: string): TrackedVehicle | undefined {
  return state.tracker.find(v => v.mid === mid);
}

function getCardEl(mid: string): HTMLElement | null {
  return document.querySelector(`.veh-card[data-mid="${mid}"]`);
}

function flashComplete(mid: string): void {
  const card = getCardEl(mid);
  if (card) retriggerAnimation(card, 'complete-flash');
}

function createVehicleCard(vehicle: TrackedVehicle, showTimer: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className =
    'veh-card' +
    (vehicle.status === 'done' ? ' done' : '') +
    (vehicle.timer.state === 'running' ? ' running' : '');
  card.dataset.mid = vehicle.mid;

  const timerHtml = showTimer
    ? `
    <div class="veh-timer">
      <span class="timer-display" role="timer" aria-label="Time left">${formatCountdown(timeRemaining(vehicle))}</span>
      ${vehicle.timer.state === 'running'
        ? `<button class="timer-btn pause" data-action="pause" aria-label="Pause timer for ${vehicle.mid}">${ICONS.pause}</button>`
        : `<button class="timer-btn" data-action="start" aria-label="Start timer for ${vehicle.mid}" ${vehicle.timer.state === 'done' ? 'disabled' : ''}>${ICONS.play}</button>`
      }
      <button class="timer-btn reset" data-action="reset" aria-label="Reset timer for ${vehicle.mid}">${ICONS.reset}</button>
    </div>`
    : '';

  card.innerHTML = `
    <div class="veh-row">
      <button class="veh-status-toggle ${vehicle.status === 'done' ? 'done' : ''}" data-action="toggle"
        aria-pressed="${vehicle.status === 'done'}" aria-label="Mark ${vehicle.mid} done">${ICONS.x}${ICONS.check}</button>
      <div class="veh-mid">${vehicle.mid}</div>
      <div class="veh-meta"><div class="veh-cat">${escapeHtml(vehicle.category || '—')}</div></div>
      ${timerHtml}
    </div>
    <div class="veh-note-row">
      <div class="note-input-wrap">
        <input type="text" class="note-input" data-mid="${vehicle.mid}" aria-label="Note for ${vehicle.mid}"
          placeholder="optional note (e.g. cannot hold charge)" value="${escapeHtml(vehicle.note || '')}" autocomplete="off">
        <button class="note-presets-btn" data-action="presets" aria-label="Saved notes" aria-haspopup="menu">▾</button>
        <div class="preset-popup" role="menu" data-popup-for="${vehicle.mid}"></div>
      </div>
    </div>`;

  return card;
}

// ─── Render tracker list ────────────────────────────────────────────────────

function renderTrackerList(state: AppState): void {
  const container = el('trackerList');
  const sections: Array<[string, boolean]> = [
    ['WPT', true],
    ['MPT', false],
  ];
  const nodes: HTMLElement[] = [];

  for (const [purpose, showTimer] of sections) {
    const vehicles = state.tracker.filter(v => v.purpose === purpose);
    if (vehicles.length === 0) continue;
    const heading = document.createElement('h2');
    heading.className = 'section-label';
    heading.textContent = purpose;
    nodes.push(heading, ...vehicles.map(v => createVehicleCard(v, showTimer)));
  }

  if (nodes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = 'No vehicles yet.<br>Generate a dispatch on the Deploy tab and your vehicles appear here.';
    nodes.push(empty);
  }

  container.replaceChildren(...nodes);
  renderSummary(state);
}

function renderSummary(state: AppState): void {
  const summary = summarizeTracker(state.tracker);
  el('trackerWptDone').textContent = String(summary.wptDone);
  el('trackerWptTotal').textContent = String(summary.wptTotal);
  el('trackerMptDone').textContent = String(summary.mptDone);
  el('trackerMptTotal').textContent = String(summary.mptTotal);
  el('trackerRunningCount').textContent = String(summary.running);
  el('updateCount').textContent =
    summary.done === 0
      ? 'No completed vehicles yet'
      : `${summary.done} vehicle${summary.done === 1 ? '' : 's'} ready`;

  const badge = el('trackerBadge');
  badge.hidden = summary.total === 0;
  badge.className =
    'tab-badge ' + (summary.running ? 'running' : summary.pending ? 'pending' : 'complete');
  badge.textContent = String(summary.running || summary.pending || '\u2713');
}

// ─── Note presets popup ─────────────────────────────────────────────────────

function togglePresetPopup(state: AppState, mid: string): void {
  // Close all other popups
  document.querySelectorAll('.preset-popup').forEach(p => p.classList.remove('show'));

  const popup = document.querySelector(`.preset-popup[data-popup-for="${mid}"]`);
  if (!popup) return;

  const input = document.querySelector(`.note-input[data-mid="${mid}"]`) as HTMLInputElement | null;

  const selectPreset = (preset: string) => {
    const vehicle = findVehicle(state, mid);
    if (vehicle) {
      vehicle.note = preset;
      persist.tracker(state);
    }
    if (input) input.value = preset;
    if (preset) {
      state.notePresets = addNotePreset(state.notePresets, preset);
      persist.notePresets(state);
    }
    (popup as HTMLElement).classList.remove('show');
  };

  // "(none)" option
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'preset-item empty';
  noneBtn.setAttribute('role', 'menuitem');
  noneBtn.textContent = '(none)';
  noneBtn.addEventListener('click', e => {
    e.stopPropagation();
    selectPreset('');
  });

  const presetItems = state.notePresets.map((preset, idx) => {
    const div = document.createElement('div');
    div.className = 'preset-item';
    div.innerHTML = `
      <button type="button" role="menuitem">${escapeHtml(preset)}</button>
      <button type="button" class="preset-x" aria-label="Delete saved note">&times;</button>
    `;
    div.firstChild?.addEventListener('click', e => {
      e.stopPropagation();
      selectPreset(preset);
    });
    div.lastChild?.addEventListener('click', e => {
      e.stopPropagation();
      state.notePresets = removeNotePreset(state.notePresets, idx);
      persist.notePresets(state);
      togglePresetPopup(state, mid); // re-render
    });
    return div;
  });

  popup.replaceChildren(noneBtn, ...presetItems);
  popup.classList.add('show');
}

// ─── Event delegation ───────────────────────────────────────────────────────

function handleCardClick(state: AppState, e: MouseEvent): void {
  const actionBtn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  if (!actionBtn) return;
  const card = actionBtn.closest('.veh-card') as HTMLElement | null;
  if (!card) return;
  const mid = card.dataset.mid;
  if (!mid) return;
  const vehicle = findVehicle(state, mid);
  if (!vehicle) return;

  e.stopPropagation();

  switch (actionBtn.dataset.action) {
    case 'toggle': {
      const newStatus = toggleDone(vehicle);
      persist.tracker(state);
      if (newStatus === 'done') {
        haptic(20);
        renderTrackerList(state);
        flashComplete(mid);
        return;
      }
      break;
    }
    case 'start':
      startTimer(vehicle);
      persist.tracker(state);
      break;
    case 'pause':
      pauseTimer(vehicle);
      persist.tracker(state);
      break;
    case 'reset':
      resetTimer(vehicle);
      persist.tracker(state);
      break;
    case 'presets':
      togglePresetPopup(state, mid);
      return;
  }

  renderTrackerList(state);
}

function handleNoteInput(state: AppState, e: Event): void {
  const input = e.target as HTMLInputElement;
  if (!input.matches('.note-input')) return;
  const mid = input.dataset.mid;
  if (!mid) return;
  const vehicle = findVehicle(state, mid);
  if (vehicle) {
    vehicle.note = input.value;
    persist.tracker(state);
    renderSummary(state);
  }
}

function handleNoteFocusOut(state: AppState, e: FocusEvent): void {
  const input = e.target as HTMLInputElement;
  if (!input.matches('.note-input')) return;
  if (input.value.trim()) {
    state.notePresets = addNotePreset(state.notePresets, input.value.trim());
    persist.notePresets(state);
  }
}

// ─── Timer tick (1-second interval) ─────────────────────────────────────────

function tick(state: AppState): void {
  const finished = tickTimers(state.tracker);
  if (finished.length) {
    persist.tracker(state);
    renderTrackerList(state);
    finished.forEach(flashComplete);
    haptic([120, 80, 120]);
    showToast(finished.length === 1 ? `${finished[0]} timer done` : `${finished.length} timers done`);
    return;
  }

  // Update running timer displays
  for (const vehicle of state.tracker) {
    if (vehicle.timer.state !== 'running') continue;
    const card = getCardEl(vehicle.mid);
    const display = card?.querySelector('.timer-display');
    if (display) display.textContent = formatCountdown(timeRemaining(vehicle));
  }
  el('trackerRunningCount').textContent = String(summarizeTracker(state.tracker).running);
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function initTrackerPage(state: AppState): void {
  const list = el('trackerList');

  // Click delegation
  list.addEventListener('click', e => handleCardClick(state, e));

  // Note input
  list.addEventListener('input', e => handleNoteInput(state, e));
  list.addEventListener('focusout', e => handleNoteFocusOut(state, e));

  // Close preset popups on outside click
  document.addEventListener('click', e => {
    if (!(e.target as HTMLElement).closest('.note-input-wrap')) {
      document.querySelectorAll('.preset-popup.show').forEach(p => p.classList.remove('show'));
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.preset-popup.show').forEach(p => p.classList.remove('show'));
    }
  });

  // 1-second tick
  setInterval(() => tick(state), 1000);

  // Clear all
  el('clearTrackerBtn').addEventListener('click', async () => {
    if (state.tracker.length === 0) return;
    const confirmed = await showConfirm(
      'Clear tracker?',
      "This removes all vehicles and their progress. It can't be undone.",
      'Clear'
    );
    if (!confirmed) return;
    state.tracker = [];
    persist.tracker(state);
    renderTrackerList(state);
    showToast('Tracker cleared');
  });

  // Render initially
  renderTrackerList(state);
}

export { renderTrackerList, renderSummary };
