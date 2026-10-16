# Dispatch Formatter

A mobile-first PWA for formatting WPT/MPT vehicle dispatches into copy-paste-ready blocks, tracking timers, and updating the list with completion statuses.

## Files

- `index.html` — main app
- `manifest.json` — PWA manifest for home-screen install
- `sw.js` — service worker for offline support
- `version.json` — version marker checked at runtime
- `icon-192.png`, `icon-512.png` — app icons

## Deploy to Netlify

Drag the entire folder onto Netlify drop zone. No build step.

## Force-update mechanism

Three places hold the version number, and they must match on every release:

1. `sw.js` → `const CACHE = 'dispatch-vN'`
2. `version.json` → `{ "v": N }`
3. `index.html` → `const APP_VERSION = N`

When you change anything in the app:

1. Bump all three to N+1
2. Redeploy

On users' next visit (or on the same visit, after 5 min, or when the tab refocuses), the app fetches `version.json`, sees a higher number than the baked-in `APP_VERSION`, and shows a "New version available" banner at the top with an Update button. Tapping it triggers a fresh reload past the cache.

## Install on phone

- **Android Chrome**: install banner in Settings → Preferences, or Chrome menu → Install
- **iOS Safari**: Share → Add to Home Screen

Works fully offline once installed. Saved users, tracker state, blocklist, theme — all in localStorage.

## Pages

1. **Deploy** — paste vehicle list, generate MT-admin output
2. **Tracker** — optional WPT 20-min timers + status switches per vehicle
3. **Update** — paste latest list, app replaces tags of completed vehicles with ✅ markers

## Slot timing

- Default start: 0840 (overrideable in the Start field)
- WPT block: 20 min, MPT block: 30 min
- 5-min buffer between every consecutive block
- If a vehicle line includes its own time range (e.g. `33572 Ethan 0840-0900`), that exact time is used and the auto-cursor follows it
- Soft cap: warn if WPT count exceeds 5 (still scheduled)
