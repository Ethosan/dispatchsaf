// ─── Update page: apply completed statuses to a fresh vehicle list ──────────

import type { AppState } from '../types';
import { doneVehicleMap } from '../lib/tracker';
import {
  el,
  renderMessages,
  setStatus,
  renderBlocks,
  extractBlockText,
  showToast,
  copyToClipboard,
  haptic,
} from '../lib/dom';
import { formatCountdown } from '../lib/time';

const DONE_MARKER = '\u2705';

const STATUS_IDS = {
  dot: 'updateStatusDot',
  text: 'updateStatusText',
  meta: 'updateStatusMeta',
};

const EMPTY_TEXT = 'Updated list appears here';

/**
 * Apply completed vehicle statuses to a pasted list.
 * Replaces each completed MID's trailing text with ✅ + note.
 */
export function applyStatuses(text: string, doneMap: Map<string, string>): {
  text: string;
  replacedCount: number;
  totalDone: number;
} {
  if (doneMap.size === 0) {
    return { text, replacedCount: 0, totalDone: 0 };
  }

  // Find all MID positions in the text
  const midRe = /(?<!\d)(\d{5})(?!\d)/g;
  const mids: Array<{ mid: string; end: number }> = [];
  let m;
  while ((m = midRe.exec(text)) !== null) {
    mids.push({ mid: m[1], end: m.index + 5 });
  }

  // Build a single output by walking through the text
  let result = '';
  let cursor = 0;
  let replaced = 0;

  for (const { mid, end } of mids) {
    // Find the end of this line (or the next MID, whichever comes first)
    let lineEnd = text.length;
    const nl = text.indexOf('\n', end);
    if (nl !== -1) lineEnd = nl;

    result += text.slice(cursor, end);

    if (doneMap.has(mid)) {
      const note = doneMap.get(mid);
      // Preserve trailing whitespace after the MID
      const trailingMatch = text.slice(end, lineEnd).match(/\s*$/);
      const trailing = trailingMatch ? trailingMatch[0] : "";
      result += (note ? ` ${DONE_MARKER} ${note}` : ` ${DONE_MARKER}`) + trailing;
      replaced++;
    } else {
      result += text.slice(end, lineEnd);
    }

    cursor = lineEnd;
  }

  result += text.slice(cursor);

  return { text: result, replacedCount: replaced, totalDone: doneMap.size };
}

export function initUpdatePage(
  state: AppState,
  onClearTracker: () => void
): void {
  const applyBtn = el<HTMLButtonElement>('applyBtn');
  const updateInput = el<HTMLTextAreaElement>('updateInput');
  const clearBtn = el<HTMLButtonElement>('clearUpdateBtn');
  const copyBtn = el<HTMLButtonElement>('updateCopyBtn');

  function clearAll(): void {
    updateInput.value = '';
    renderBlocks('updateOutput', [], 'updateCopyBtn', EMPTY_TEXT);
    renderMessages('updateMessages', []);
    setStatus(STATUS_IDS, '', 'awaiting input', '—');
  }

  function runApply(): void {
    const text = updateInput.value.trim();

    const fail = (msg: string, statusText: string) => {
      renderMessages('updateMessages', [{ kind: 'err', text: msg }]);
      setStatus(STATUS_IDS, 'err', statusText, '—');
      renderBlocks('updateOutput', [], 'updateCopyBtn', EMPTY_TEXT);
    };

    if (!text) return fail('Paste the latest list first.', 'no input');

    const doneMap = doneVehicleMap(state.tracker);
    if (doneMap.size === 0) return fail('No completed vehicles in the Tracker yet.', 'nothing to apply');

    const result = applyStatuses(text, doneMap);
    renderBlocks('updateOutput', [{ text: result.text }], 'updateCopyBtn', EMPTY_TEXT);

    const messages: Array<{ kind: string; text: string }> = [];
    if (result.replacedCount === 0) {
      messages.push({ kind: 'warn', text: 'None of your completed MIDs are in the pasted list.' });
    } else {
      messages.push({
        kind: 'info',
        text: `Ticked ${result.replacedCount} of ${result.totalDone} completed vehicles.`,
      });
      const notInList = [...doneMap.keys()].filter(mid => !text.includes(mid));
      if (notInList.length) {
        messages.push({ kind: 'warn', text: `Not in pasted list: ${notInList.join(', ')}` });
      }
    }
    renderMessages('updateMessages', messages);
    setStatus(
      STATUS_IDS,
      result.replacedCount > 0 ? 'ok' : 'warn',
      result.replacedCount > 0 ? 'ready' : 'no match',
      `${result.replacedCount}/${result.totalDone} ticked`
    );
  }

  applyBtn.addEventListener('click', runApply);

  updateInput.addEventListener('paste', () => {
    if (state.autoGen) {
      setTimeout(() => {
        if (updateInput.value.trim() && doneVehicleMap(state.tracker).size) runApply();
      }, 30);
    }
  });

  clearBtn.addEventListener('click', () => {
    updateInput.value = '';
    updateInput.focus();
  });

  copyBtn.addEventListener('click', async () => {
    const text = extractBlockText('updateOutput');
    if (!text) return;
    await copyToClipboard(text);
    copyBtn.classList.add('success');
    setTimeout(() => copyBtn.classList.remove('success'), 1000);
    haptic(20);
    // Clear tracker after copying
    setTimeout(() => {
      onClearTracker();
      clearAll();
      showToast('Copied. Tracker cleared for the next round');
    }, 1100);
  });

  clearAll();
}

export { STATUS_IDS as UPDATE_STATUS_IDS, EMPTY_TEXT as UPDATE_EMPTY_TEXT, formatCountdown };
