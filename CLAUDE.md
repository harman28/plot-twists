# Plot Twists — Claude Code Briefing

## What this is

This is a personal research tool and public digital garden called **Plot Twists**, built for Prabhnoor Kohli (prabhnoorkohli.fyi), a researcher in critical AI studies. It was designed and built iteratively in Claude.ai (Sonnet 4.6) and is now being deployed as a standalone web app.

The app has two modes:
- **Private dispatch** (full app): a daily reading tool with dispatch, knowledge garden, stats, and source management
- **Public garden** (future): a read-only view for the portfolio — not yet separated, but planned

---

## Deployment status — COMPLETE (as of 2026-05-15)

The site is live. Nothing from the original job list remains.

| Item | Status |
|---|---|
| `window.storage` → `localStorage` | Done — all 7 calls replaced in `src/App.jsx` |
| `npm install` + `npm run build` | Clean build (Node 20 via nvm required — Node 15 is too old for Vite 5) |
| GitHub repo created | https://github.com/harman28/plot-twists (under `harman28`) |
| Netlify site created | https://plot-twists.netlify.app (site ID: `acf073e2-7f70-462e-ad14-15f0162485cc`) |
| Auto-deploy on push | GitHub Actions workflow at `.github/workflows/deploy.yml` — triggers on push to `main` |
| Custom domain | Not yet — Prabhnoor wants to come back to `garden.prabhnoorkohli.fyi` later |

### What's left (next session)
- Custom domain `garden.prabhnoorkohli.fyi` — configure in Netlify dashboard, get DNS record for Prabhnoor to add at her registrar
- Revoke the Supabase access token used in this session — it was shared in chat (find it in supabase.com/dashboard/account/tokens)

### Infra notes
- Netlify CLI v17 required — latest CLI fails with `Intl.Segmenter is not a constructor` on this machine
- Always use `source ~/.nvm/nvm.sh && nvm use 20` before running `npm` or `netlify` — system Node is v15
- GitHub secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` are set on the repo — don't need to redo this
- Netlify account slug: `harman28`, team name: "Chess Scenes"

### Supabase
- Project: `plot-twists`, ref: `sigsirczbfuhdkhyfxpv`, region: us-east-1 (East US)
- Org: `rxtedsertqlezledgtrz` (prabhnoorkohliwork@gmail.com's Org)
- DB password: stored in Supabase dashboard only — do not commit here
- Project URL: `https://sigsirczbfuhdkhyfxpv.supabase.co`
- Auth: magic link email, site URL set to `https://plot-twists.netlify.app`
- Tables: `read_items`, `notes`, `custom_items` — all with RLS, users own their own rows
- Env vars set on Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Local dev: `.env.local` has the keys (gitignored via `*.local`)

---

## Tech stack

- **React 18** + **Vite 5**
- **D3 v7** (force simulation, zoom, drag — used heavily in the garden view)
- **@supabase/supabase-js** — database + auth
- Deploy target: **Netlify** (netlify.toml is included, build command: `npm run build`, publish dir: `dist`)

---

## Project structure

```
plot-twists/
├── index.html          # Entry HTML, sets title + meta
├── package.json        # Dependencies
├── vite.config.js      # Vite config, base = '/'
├── netlify.toml        # Build + redirect config for Netlify
├── .gitignore
├── CLAUDE.md           # This file
└── src/
    ├── main.jsx        # React root mount
    └── App.jsx         # Entire application (~1200 lines)
```

---

## App architecture (so you understand what you're deploying)

`App.jsx` is a single-file React app. Everything lives in it — data, components, and logic. Key parts:

### Shared state (root `App` component)
- `pool` — merged array of `BUILTIN` (104 hardcoded items) + `customItems` (user-added)
- `readItems` — Set of URLs the user has marked read
- `notes` — object keyed by URL, each with `{ argument, thoughts }`
- `customItems` — user-added sources, same shape as BUILTIN items
- All state persists via `window.storage` (Claude artifact storage API — see note below)

### Four tabs
1. **Dispatch** — daily reading list, date-navigable, seeded shuffle from pool
2. **Garden** — D3 force graph, 8 theme bubbles, keyword edges, sidebar, navigate-to-node
3. **Stats** — reading progress by theme and type, notes review
4. **+ Add Source** — form to add custom items to the pool

### The `window.storage` API — DONE
This has already been replaced with `localStorage` in `src/App.jsx`. No action needed.

---

## Known issues / things to check

1. ~~**`window.storage` replacement**~~ — **DONE**
2. **D3 import** — confirmed working after `npm install` on Node 20
3. **No CSS files** — all styling is inline. No need to import any stylesheet
4. **No router** — single page, no routing needed. The `netlify.toml` redirect handles direct URL loads
5. **Build output** — Vite outputs to `dist/`. Netlify publish dir is set to `dist` in `netlify.toml`

---

## What NOT to change

- The data (`BUILTIN` array — 104 items) — do not touch
- The D3 simulation logic — fragile, leave it alone
- The theme colours and parchment palette — intentional design
- The `window.storage` → `localStorage` replacement is the only required code change

---

## Context on the owner

- Name: Prabhnoor Kohli
- Site: prabhnoorkohli.fyi
- The public garden subdomain target (when ready): `garden.prabhnoorkohli.fyi`
- The app title in the browser tab should read: `Plot Twists — Prabhnoor's Digital Garden`
- This is already set in `index.html`

---

## After deployment — DONE

Prabhnoor's info:
1. **Live URL:** https://plot-twists.netlify.app
2. **Custom domain:** not set up yet — come back when ready
3. **To redeploy:** push any change to `main` on https://github.com/harman28/plot-twists — Netlify auto-deploys via GitHub Actions
