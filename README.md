# Dispatch

Turns the WPT / MPT vehicle list into copy-paste dispatch blocks, times each WPT, and ticks off completed vehicles. Installable as a PWA.

> **This repository holds the live built files recovered from Netlify, not the original source.**
> The files in `assets/` are minified Vite output. The original source code was not recovered, so changes have to be made either in the built files or by rebuilding the app from scratch.

| | |
| --- | --- |
| **Live** | https://dispatchsaf.netlify.app |
| **Hosting** | Netlify site `dispatchsaf` |
| **Data** | Stays in the browser (`localStorage`). No server or account. |
| **Settings** | None. |
| **Repository** | [gitlab.com/eatentam/dispatchsaf](https://gitlab.com/eatentam/dispatchsaf) |

## Run locally

No install or build step. Serve the folder with any static server:

```sh
npx serve .
```

Then open the address it prints. Opening `index.html` straight from disk won't work, because the service worker and absolute `/assets/` paths need a server.

## Deploy

`netlify.toml` is the one from the original source. It still says `command = "npm run build"` and `publish = "dist"`, which won't work from this repository (there is no `package.json` and no `dist/`). To redeploy from here, clear the build command and set the publish directory to the repository root (`.`).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell |
| `assets/` | Built JavaScript and CSS (minified) |
| `manifest.*`, icons | PWA install metadata and icons |
| `sw.js` | Service worker (offline cache) |
| `netlify.toml` | Netlify headers (see *Deploy*) |
