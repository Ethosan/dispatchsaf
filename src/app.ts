declare const __APP_VERSION__: string;
// ─── Dispatch — Main entry point ────────────────────────────────────────────

import './styles/main.css';

import type { AppState, Page } from './types';
import { loadState, persist } from './lib/state';
import { formatDate, pad2, addDays } from './lib/time';
import { el, showToast } from './lib/dom';

import { initSettings, applyTheme, setAutoGen, setTrackerEnabled } from './ui/settings';
import { initDeployPage } from './ui/deploy';
import { initTrackerPage, renderTrackerList } from './ui/tracker';
import { initUpdatePage } from './ui/update';

// ─── State ──────────────────────────────────────────────────────────────────

const state: AppState = loadState();
persist.users(state); // ensure storage is initialised

// ─── Navigation ─────────────────────────────────────────────────────────────

function navigateTo(page: Page): void {
  state.page = page;
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', (p as HTMLElement).id === `page-${page}`);
  });
  document.querySelectorAll('.tab-item').forEach(tab => {
    const isActive = (tab as HTMLElement).dataset.page === page;
    tab.classList.toggle('active', isActive);
    if (isActive) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (page === 'tracker') renderTrackerList(state);
}

// ─── Header clock ───────────────────────────────────────────────────────────

function updateClock(): void {
  const now = new Date();
  el('headerDate').textContent = formatDate(now);
  el('headerTime').textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  el('datePickerShown').textContent = formatDate(addDays(state.dayOffset));
}

// ─── PWA install prompt ─────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  el('installBanner').classList.add('show');
});

el('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    el('installBanner').classList.remove('show');
    showToast('Installing…');
  }
  deferredPrompt = null;
});

addEventListener('appinstalled', () => {
  el('installBanner').classList.remove('show');
});

// ─── Service worker update handling ─────────────────────────────────────────

function watchServiceWorker(reg: ServiceWorkerRegistration): void {
  const showUpdateBanner = (worker: ServiceWorker) => {
    el('updateBanner').classList.add('show');
    el<HTMLButtonElement>('updateBannerBtn').onclick = () => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  };

  if (reg.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner(reg.waiting);
  }

  reg.addEventListener('updatefound', () => {
    const newWorker = reg.installing;
    newWorker?.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner(newWorker);
      }
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true;
      location.reload();
    }
  });

  const checkForUpdate = () => reg.update().catch(() => {});
  setInterval(checkForUpdate, 300 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

// ─── Boot ───────────────────────────────────────────────────────────────────

function boot(): void {
  // Apply saved theme
  applyTheme(state, state.theme);

  // Tab bar navigation
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      navigateTo((tab as HTMLElement).dataset.page as Page);
    });
  });
  el('goToUpdateBtn').addEventListener('click', () => navigateTo('update'));

  // Settings
  initSettings(state, {
    onTrackerChange: enabled => {
      if (!enabled && state.page === 'tracker') navigateTo('deploy');
    },
  });

  // Pages
  initDeployPage(
    state,
    () => renderTrackerList(state),
    () => {
      el('modal').classList.add('show');
      el('modal').setAttribute('aria-hidden', 'false');
    }
  );
  initTrackerPage(state);
  initUpdatePage(
    state,
    () => {
      state.tracker = [];
      persist.tracker(state);
      renderTrackerList(state);
    }
  );

  // Apply initial prefs
  setAutoGen(state, state.autoGen);
  setTrackerEnabled(state, state.trackerEnabled);

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Service worker
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
    const bv = document.getElementById('brandVersion'); if (bv) bv.textContent = 'v' + __APP_VERSION__;
      navigator.serviceWorker
        .register('/sw.js')
        .then(watchServiceWorker)
        .catch(() => {});
    });
  }
}

boot();
