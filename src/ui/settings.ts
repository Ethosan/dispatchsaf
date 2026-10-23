declare const __APP_VERSION__: string;
// ─── Settings modal ─────────────────────────────────────────────────────────

import type { AppState, SettingsTab, Theme } from '../types';

import { DEFAULT_BLOCKLIST, activeUser, exportBackup, importBackup, persist } from '../lib/state';
import {
  el,
  escapeHtml,
  showToast,
  showConfirm,
  retriggerAnimation,
} from '../lib/dom';

let previousFocus: HTMLElement | null = null;
let onTrackerChange: (enabled: boolean) => void = () => {};

// ─── Theme ──────────────────────────────────────────────────────────────────

export function applyTheme(state: AppState, theme: Theme): void {
  state.theme = theme;
  persist.theme(state);

  const resolved =
    theme === 'auto'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  document.documentElement.setAttribute('data-theme', resolved);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', resolved === 'dark' ? '#0f1117' : '#f3f4f6');
  }

  document.querySelectorAll('#themeSeg button').forEach(btn => {
    const isActive = (btn as HTMLButtonElement).dataset.theme === theme;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

// ─── Prefs ──────────────────────────────────────────────────────────────────

function setPrefToggle(pref: string, value: boolean): void {
  document.querySelectorAll(`.pref-toggle[data-pref="${pref}"]`).forEach(btn => {
    const isOn = (btn as HTMLButtonElement).dataset.value === 'on' === value;
    btn.classList.toggle('active', isOn);
    btn.setAttribute('aria-pressed', String(isOn));
  });
}

export function setAutoGen(state: AppState, enabled: boolean): void {
  state.autoGen = enabled;
  persist.autoGen(state);
  setPrefToggle('autoGen', enabled);
}

export function setTrackerEnabled(state: AppState, enabled: boolean): void {
  state.trackerEnabled = enabled;
  persist.trackerEnabled(state);
  setPrefToggle('tracker', enabled);
  el('trackerTab').hidden = !enabled;
  onTrackerChange(enabled);
}

// ─── User list rendering ────────────────────────────────────────────────────

function renderActiveUserCard(state: AppState): void {
  const user = activeUser(state);
  const nameEl = el('auName');
  nameEl.textContent = user ? `${user.rank} ${user.name.toUpperCase()}` : 'Not set';
  nameEl.classList.toggle('empty', !user);
}

function renderSavedUsers(state: AppState): void {
  const container = el('savedList');
  el('userCount').textContent = String(state.users.length);

  if (state.users.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved users yet</div>';
    return;
  }

  container.innerHTML = state.users
    .map((user, idx) => {
      const aliases = (user.aliases || []).filter(a => a && a.trim());
      return `
      <div class="user-card${idx === state.activeIdx ? ' active' : ''}">
        <button type="button" class="user-card-info" data-action="select" data-i="${idx}" aria-pressed="${idx === state.activeIdx}">
          <span class="user-card-name">${escapeHtml(user.rank)} ${escapeHtml(user.name.toUpperCase())}</span>
          ${aliases.length ? `<span class="user-card-aliases">${aliases.map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`).join('')}</span>` : ''}
        </button>
        <button type="button" class="user-card-edit" data-action="edit" data-i="${idx}" aria-label="Edit ${escapeHtml(user.name)}">Edit</button>
        <button type="button" class="user-card-del" data-action="del" data-i="${idx}" aria-label="Delete ${escapeHtml(user.name)}">&times;</button>
      </div>`;
    })
    .join('');
}

function renderBlocklist(state: AppState): void {
  const container = el('blocklist');
  container.innerHTML = state.blocklist
    .map(
      (code, idx) => `
      <span class="bl-chip"><span>${escapeHtml(code)}</span><button type="button" class="x" data-i="${idx}" aria-label="Remove ${escapeHtml(code)}">&times;</button></span>`
    )
    .join('');
  el('blocklistCount').textContent = String(state.blocklist.length);
}

function clearUserForm(): void {
  el<HTMLInputElement>('userName').value = '';
  el<HTMLSelectElement>('userAliases').value = '';
  el<HTMLSelectElement>('userRank').value = 'PTE';
}

// ─── Tab indicator ──────────────────────────────────────────────────────────

function updateTabIndicator(): void {
  const activeTab = document.querySelector('.modal-tabs .tab.active') as HTMLElement | null;
  if (!activeTab) return;
  const indicator = el('tabIndicator');
  indicator.style.width = `${activeTab.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;
}

function switchTab(tab: SettingsTab): void {
  document.querySelectorAll('.modal-tabs .tab').forEach(btn => {
    const isActive = (btn as HTMLButtonElement).dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', (panel as HTMLElement).id === `tab-${tab}`);
  });
  updateTabIndicator();
}

// ─── Modal open/close ───────────────────────────────────────────────────────

function openModal(tab: SettingsTab): void {
  previousFocus = document.activeElement as HTMLElement | null;
  const modal = el('modal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  switchTab(tab);
  requestAnimationFrame(() => {
    updateTabIndicator();
    el<HTMLButtonElement>('closeModal').focus();
  });
}

function closeModal(): void {
  const modal = el('modal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  previousFocus?.focus?.();
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function initSettings(
  state: AppState,
  callbacks: { onTrackerChange: (enabled: boolean) => void }
): void {
  onTrackerChange = callbacks.onTrackerChange;

  // Tab switching
  document.querySelectorAll('.modal-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab((btn as HTMLButtonElement).dataset.tab as SettingsTab);
    });
  });

  // Open/close
  el('settingsBtn').addEventListener('click', () => openModal('users'));
  el('activeUserCard').addEventListener('click', () => openModal('users'));
  el('closeModal').addEventListener('click', closeModal);
  el('modal').addEventListener('click', e => {
    if (e.target === el('modal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el('modal').classList.contains('show') && !el('confirmOverlay').classList.contains('show')) {
      closeModal();
    }
  });
  addEventListener('resize', updateTabIndicator);

  // Save user
  el('saveUserBtn').addEventListener('click', () => {
    const name = el<HTMLInputElement>('userName').value.trim();
    if (!name) {
      showToast('Name required');
      el('userName').focus();
      return;
    }
    const user = {
      rank: el<HTMLSelectElement>('userRank').value as AppState['users'][number]['rank'],
      name,
      aliases: el<HTMLInputElement>('userAliases').value
        .split(',')
        .map(a => a.trim())
        .filter(Boolean),
    };
    const existing = state.users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) {
      state.users[existing] = user;
      state.activeIdx = existing;
    } else {
      state.users.push(user);
      state.activeIdx = state.users.length - 1;
    }
    persist.users(state);
    renderSavedUsers(state);
    renderActiveUserCard(state);
    clearUserForm();
    showToast('Saved and set active');
  });

  el('clearUserFormBtn').addEventListener('click', clearUserForm);

  // Saved user actions
  el('savedList').addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const idx = parseInt(btn.dataset.i ?? '', 10);
    const user = state.users[idx];
    if (!user) return;

    if (btn.dataset.action === 'select') {
      state.activeIdx = idx;
      persist.users(state);
      renderSavedUsers(state);
      renderActiveUserCard(state);
      retriggerAnimation(el('activeUserCard'), 'pulse');
      showToast('Active user set');
    } else if (btn.dataset.action === 'edit') {
      el<HTMLInputElement>('userName').value = user.name;
      el<HTMLSelectElement>('userRank').value = user.rank;
      el<HTMLInputElement>('userAliases').value = (user.aliases || []).join(', ');
      el('userName').focus();
    } else if (btn.dataset.action === 'del') {
      const confirmed = await showConfirm(
        'Delete user?',
        `${user.rank} ${user.name.toUpperCase()} will be removed from this device.`,
        'Delete'
      );
      if (!confirmed) return;
      state.users.splice(idx, 1);
      if (state.activeIdx === idx) state.activeIdx = -1;
      else if (state.activeIdx > idx) state.activeIdx--;
      persist.users(state);
      renderSavedUsers(state);
      renderActiveUserCard(state);
    }
  });

  // Blocklist
  el('blocklist').addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('.x') as HTMLElement | null;
    if (!btn) return;
    state.blocklist.splice(parseInt(btn.dataset.i ?? '', 10), 1);
    persist.blocklist(state);
    renderBlocklist(state);
  });

  el('addStatusBtn').addEventListener('click', () => {
    const input = el<HTMLInputElement>('addStatus');
    const value = input.value.trim();
    if (!value) return;
    if (state.blocklist.some(c => c.toLowerCase() === value.toLowerCase())) {
      showToast('Already in the list');
    } else {
      state.blocklist.push(value);
      persist.blocklist(state);
      renderBlocklist(state);
      showToast('Added');
    }
    input.value = '';
  });

  el<HTMLInputElement>('addStatus').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el('addStatusBtn').click();
    }
  });

  el('resetBlocklistBtn').addEventListener('click', async () => {
    const confirmed = await showConfirm(
      'Reset status codes?',
      'Your custom codes will be replaced with the default list.',
      'Reset'
    );
    if (!confirmed) return;
    state.blocklist = [...DEFAULT_BLOCKLIST];
    persist.blocklist(state);
    renderBlocklist(state);
    showToast('Reset to defaults');
  });

  // Theme
  document.querySelectorAll('#themeSeg button').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(state, (btn as HTMLButtonElement).dataset.theme as Theme);
    });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') applyTheme(state, 'auto');
  });

  // Pref toggles
  document.querySelectorAll('.pref-toggle[data-pref="autoGen"]').forEach(btn => {
    btn.addEventListener('click', () => {
      setAutoGen(state, (btn as HTMLButtonElement).dataset.value === 'on');
    });
  });
  document.querySelectorAll('.pref-toggle[data-pref="tracker"]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTrackerEnabled(state, (btn as HTMLButtonElement).dataset.value === 'on');
    });
  });

  // Backup / Restore
  el('exportBtn').addEventListener('click', () => {
    const blob = new Blob([exportBackup(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dispatch-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  el('importBtn').addEventListener('click', () => el<HTMLInputElement>('importFile').click());

  el<HTMLInputElement>('importFile').addEventListener('change', async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      const text = await file.text();
      importBackup(state, text);
      renderSavedUsers(state);
      renderBlocklist(state);
      renderActiveUserCard(state);
      applyTheme(state, state.theme);
      setPrefToggle('autoGen', state.autoGen);
      setPrefToggle('tracker', state.trackerEnabled);
      showToast('Backup restored');
    } catch (err) {
      showToast((err as Error).message || 'Could not read that file');
    }
  });

  // Version
  el('appVersion').textContent = `v${__APP_VERSION__}`;

  // Initial render
  renderSavedUsers(state);
  renderBlocklist(state);
  renderActiveUserCard(state);
}
