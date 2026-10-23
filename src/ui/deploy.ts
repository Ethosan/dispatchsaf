// ─── Deploy page ────────────────────────────────────────────────────────────

import type { AppState, Message } from '../types';
import { activeUser, persist } from '../lib/state';
import { parseVehicleList, extractTags } from '../lib/parse';
import { generateDispatch, plural } from '../lib/format';
import { syncTracker } from '../lib/tracker';
import { formatDate, addDays, parseTime, minutesToHM } from '../lib/time';
import {
  el,
  renderMessages,
  setStatus,
  renderBlocks,
  extractBlockText,

  copyToClipboard,
  haptic,
  retriggerAnimation,
} from '../lib/dom';

const STATUS_IDS = {
  dot: 'statusDot',
  text: 'statusText',
  meta: 'statusMeta',
};

function fail(msg: string, statusText: string): void {
  renderMessages('messages', [{ kind: 'err', text: msg }]);
  setStatus(STATUS_IDS, 'err', statusText, '—');
  renderBlocks('output', [], 'copyBtn');
}

function updateDateDisplay(state: AppState): void {
  el('datePickerShown').textContent = formatDate(addDays(state.dayOffset));
}

export function initDeployPage(
  state: AppState,
  onTrackerSync: () => void,
  openSettings: (tab: string) => void
): void {
  const generateBtn = el<HTMLButtonElement>('generateBtn');
  const rawInput = el<HTMLTextAreaElement>('rawInput');
  const timeOverride = el<HTMLInputElement>('timeOverride');
  const copyBtn = el<HTMLButtonElement>('copyBtn');

  function runGenerate(): void {
    const raw = rawInput.value.trim();
    retriggerAnimation(generateBtn, 'firing');

    const user = activeUser(state);
    if (!user) {
      fail('No active user. Tap the user card to set one.', 'no user');
      openSettings('users');
      return;
    }

    if (!raw) {
      fail('Paste the vehicle list first.', 'no input');
      return;
    }

    let startOverride: number | null = null;
    const timeVal = timeOverride.value.trim();
    if (timeVal) {
      startOverride = parseTime(timeVal);
      if (startOverride === null) {
        fail('Invalid start time. Use HHMM (e.g. 0840) or leave blank.', 'bad time');
        return;
      }
    }

    const list = extractTags(parseVehicleList(raw), state.blocklist);
    const dateStr = formatDate(addDays(state.dayOffset));
    const result = generateDispatch(user, list, dateStr, startOverride);

    if (result.total === 0) {
      renderBlocks('output', [], 'copyBtn');
      const allTags = [...new Set([...list.WPT, ...list.MPT].map(v => v.tag).filter(Boolean) as string[])];
      const totalListed = list.WPT.length + list.MPT.length;
      const messages: Message[] = [
        {
          kind: 'err',
          text: `No vehicles found for "${user.name.toUpperCase()}" in ${plural(totalListed, 'listed vehicle')}.`,
        },
      ];
      if (allTags.length) {
        messages.push({
          kind: 'info',
          text: 'Names in this list: ' + allTags.join(', ') + '. Add one as an alias in Settings if it is you.',
        });
      }
      renderMessages('messages', messages);
      setStatus(STATUS_IDS, 'err', 'no match', '0 vehicles');
      return;
    }

    // Sync tracker
    if (state.trackerEnabled) {
      state.tracker = syncTracker(state.tracker, result.allMatches);
      persist.tracker(state);
      onTrackerSync();
    }

    // Build messages
    const messages: Message[] = [];
    if (result.wptOverflow > 0) {
      messages.push({
        kind: 'warn',
        text: `${result.wptCount} WPT vehicles, over the soft cap of 5.`,
      });
    }
    if (result.embeddedCount > 0) {
      messages.push({
        kind: 'info',
        text: `Used the time written on the list for ${result.embeddedCount} of ${plural(result.total, 'vehicle')}.`,
      });
    }
    messages.push({
      kind: 'info',
      text:
        `Slots ${minutesToHM(result.startMin)} to ${minutesToHM(result.endMin)}` +
        (startOverride !== null ? ' (custom start)' : '') +
        (state.dayOffset === 1 ? `, tomorrow ${dateStr}` : '') +
        '.',
    });
    if (state.trackerEnabled) {
      messages.push({ kind: 'info', text: `Synced ${plural(result.total, 'vehicle')} to Tracker.` });
    }
    renderMessages('messages', messages);

    renderBlocks('output', result.blocks, 'copyBtn');
    setStatus(
      STATUS_IDS,
      result.wptOverflow > 0 ? 'warn' : 'ok',
      result.wptOverflow > 0 ? 'ready (check)' : 'ready',
      `${result.wptCount} WPT · ${result.mptCount} MPT`
    );
  }

  generateBtn.addEventListener('click', runGenerate);

  rawInput.addEventListener('paste', () => {
    if (state.autoGen) {
      setTimeout(() => {
        if (rawInput.value.trim() && activeUser(state)) runGenerate();
      }, 30);
    }
  });

  rawInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runGenerate();
    }
  });

  // Time override
  const timeReset = el<HTMLButtonElement>('timeReset');
  const timeLabel = el('timeLabel');

  function updateTimeLabel(hasValue: boolean): void {
    timeReset.classList.toggle('show', hasValue);
    timeLabel.textContent = hasValue ? 'Start (custom)' : 'Start (default)';
  }

  timeOverride.addEventListener('input', (e: Event) => {
    const cleaned = (e.target as HTMLInputElement).value.replace(/[^\d]/g, '').slice(0, 4);
    (e.target as HTMLInputElement).value = cleaned;
    updateTimeLabel(!!cleaned);
  });

  timeReset.addEventListener('click', e => {
    e.preventDefault();
    timeOverride.value = '';
    updateTimeLabel(false);
  });

  // Date segmented control
  document.querySelectorAll('#dateSeg button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.dayOffset = parseInt((btn as HTMLButtonElement).dataset.day ?? '0', 10) || 0;
      document.querySelectorAll('#dateSeg button').forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      });
      updateDateDisplay(state);
    });
  });

  // Copy all
  copyBtn.addEventListener('click', async () => {
    const text = extractBlockText('output');
    if (!text) return;
    await copyToClipboard(text);
    copyBtn.classList.add('success');
    setTimeout(() => copyBtn.classList.remove('success'), 1000);
    haptic(20);
  });

  // Clear output
  el('clearOutBtn').addEventListener('click', () => {
    renderBlocks('output', [], 'copyBtn');
    renderMessages('messages', []);
    setStatus(STATUS_IDS, '', 'awaiting input', '—');
  });

  // Clear input
  el('clearRawBtn').addEventListener('click', () => {
    rawInput.value = '';
    rawInput.focus();
  });

  // Init
  setStatus(STATUS_IDS, '', 'awaiting input', '—');
  updateDateDisplay(state);
}
