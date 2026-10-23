# Cloudflare Pages Migration — dispatchsaf

> **Account**: Log into Cloudflare Dashboard as **ethantam0206@gmail.com** (not eatentam@gmail.com).

## What changed

- `public/_headers` already exists and matches the Netlify headers. No code changes needed.
- No environment variables. No functions. No redirects.

## Cloudflare Pages Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Select **GitLab** → `eatentam/dispatchsaf`
3. Configure:
   | Setting | Value |
   |---|---|
   | Project name | `dispatchsaf` |
   | Production branch | `main` |
   | Root directory | `/` (leave as default) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
4. **Environment variables**: None needed.
5. **Compatibility flags**: None needed.
6. Click **Save and Deploy**

## Custom Domain

No custom domain on Netlify (uses `dispatchsaf.netlify.app` subdomain). After migration, the site will be at `dispatchsaf.pages.dev`. If you want a custom domain, add it in Pages → Custom domains.

## Post-Migration

- Verify the site loads at `https://dispatchsaf.pages.dev`
- Verify the feedback widget works (floating button bottom-right)
- The old Netlify deploy at `dispatchsaf.netlify.app` can be left as-is or deleted later
