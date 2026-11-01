# Dispatch brand guide

The look Dispatch already has, read from the live app at v3.1.1 (cool grey · one indigo · status colours only for status · Big Shoulders Display, Public Sans, JetBrains Mono). Full guide: [DESIGN.html](DESIGN.html). Open it from a checkout: it loads the repo's own icons by relative path.

| What | Where |
|---|---|
| Mark | `public/icon-512.png` and `icon-192.png` (cream d on indigo); in the app, the dot and the word in `index.html` |
| Colours | `tokens.json` here, read from `src/styles/tokens.css` (light and dark) |
| Type | Big Shoulders Display, Public Sans and JetBrains Mono, from Google Fonts |

Nothing in this folder is new artwork: every colour, font and file it names is already in the app.

## Repo avatar and social preview

| File | Where it's used |
|---|---|
| `docs/brand/avatar.png` | GitLab project avatar (Settings > General), 512×512 |
| `docs/brand/social-preview.png` | GitHub social preview (github.com/Ethosan/dispatchsaf, Settings > Social preview), 1280×640 |

Every one of these repos follows the same spec: a 512×512 PNG avatar with the project's own mark on its own background to every edge, since GitLab and GitHub round it themselves; and, for repos mirrored to GitHub, a 1280×640 social preview with the avatar tile, the name and the repo description, no URL. Both are made from the mark, not new artwork.
