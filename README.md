# Dispatch

A phone-first web app for vehicle dispatch duty. Paste the WPT / MPT vehicle list from the group chat and it:

1. **Finds your vehicles** by your name or any alias, skipping status codes like `VOR`, `NO KEY` or `KIV`.
2. **Builds the dispatch blocks** ready to paste back, with time slots worked out for you.
3. **Tracks the run:** a 20-minute timer per WPT, a done tick per vehicle and an optional note (*cannot hold charge*).
4. **Updates the list:** paste the latest list and every vehicle you finished gets `✅` (plus its note) in place of its tag. Everything else stays exactly as it was.

> **History:** First built in August 2025 and deployed on Netlify. Moved to GitHub in October 2026, so the commit history starts there.

It works offline once opened, installs to the home screen, and keeps everything on the device (localStorage). Nothing is sent anywhere.

## How the slots are worked out

| Rule | Value |
|---|---|
| Default start | 0840 (or the **Start** box) |
| WPT slot | 20 min |
| MPT slot | 30 min |
| Gap between slots | 5 min |
| Order | all WPT, then all MPT |
| Time written on the line (`0840-0900`) | used as-is for that vehicle |
| More than 5 WPT | allowed, flagged |

Each block looks like:

```
DATE: 161026
TIME: 0840-0900
MID: 12345
TO: CPL ETHAN
VC: -
LOCATION: KHC- KHC
PURPOSE: WPT
```

Tap **Copy all** for every block, or tap a single block to copy just that one.

## Settings

- **Users:** save yourself (and anyone who borrows your phone) with rank and aliases. Aliases are matched as whole words, and output always uses the official name.
- **Status codes:** words after a MID that are not names. Add new ones when a list uses a code the app doesn't know.
- **Prefs:** light / dark / auto theme, auto-generate on paste, hide the Tracker, and **Backup** (export/import users, status codes and saved notes as JSON) for moving to a new phone.

## Project structure

```
index.html              page markup
src/
  main.js               boot, page switching, PWA install and update banner
  store.js              state + localStorage, defaults, backup import/export
  lib/                  pure logic, unit tested
    parser.js           list parsing, tag extraction, name matching
    schedule.js         slot timing and block formatting
    apply-statuses.js   ticking completed vehicles in the latest list
    time.js             DDMMYY / HHMM helpers
  tracker/
    model.js            tracker state and timers
    view.js             tracker cards
  ui/
    deploy.js           Deploy page
    update.js           Update page
    settings.js         settings sheet
    dom.js              toast, confirm dialog, output and copy helpers
  styles/               tokens, base, layout and one file per page
public/                 manifest, icons, service worker (copied as-is)
tests/                  Vitest tests for src/lib
netlify.toml            build settings and headers
```

## Develop

Needs Node 20 or newer.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # parser, scheduler and update logic
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run audit:design` | [impeccable](https://www.npmjs.com/package/impeccable) design anti-pattern scan (`npx impeccable` if not installed) |

**New vehicle category in the list?** Add it to `CATEGORY_SOURCES` in `src/lib/parser.js` and add a test.

## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub →** `Ethosan/dispatchsaf`. (For the existing site: **Site configuration → Build & deploy → Link repository**.)
2. Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`. Nothing to fill in.
3. Every push to `main` deploys. Installed copies show an **Update** banner the next time they open.

To force installed apps to refresh their offline cache, bump `CACHE` in `public/sw.js`.
