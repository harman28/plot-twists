# Plot Twists — Claude Code Briefing

## What this is

A personal research tool and public digital garden for **Prabhnoor Kohli** (prabhnoorkohli.fyi), a researcher in critical AI studies. Built iteratively in Claude.ai, then deployed as a standalone web app by Harman Singh.

Two modes:
- **Private app** (password-protected): full tool — daily reading dispatch, knowledge graph, trails, field map, stats, source management
- **Public garden** (`PublicGardenPage` export): read-only view, no auth required — same Grove/Trails/Field views with Prabhnoor's curated data

**Live URL:** https://plot-twists.netlify.app  
**To redeploy:** push to `main` on GitHub → Netlify auto-deploys via GitHub Actions (`.github/workflows/deploy.yml`)

---

## Tech stack

- **React 18** + **Vite 5** — build with `npm run build` (requires Node 20 via nvm on this machine — system Node is v15)
- **D3 v7** — force simulation, zoom, drag, SVG rendering in the Grove
- **@supabase/supabase-js** — database + auth (magic link + password)
- **Netlify** — hosting, `netlify.toml` sets build command and publish dir (`dist/`)
- **No CSS files** — all styling is inline JSX. No stylesheets to import.
- **No router** — single page, `netlify.toml` redirects all paths to `index.html`

Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are in `.env.local` (gitignored) and set as Netlify env vars for production.

---

## Project structure

```
plot-twists/
├── src/
│   ├── main.jsx        # React root mount — don't touch
│   ├── App.jsx         # Entire application (~3050 lines)
│   └── supabase.js     # Supabase client init
├── index.html          # Title: "Plot Twists — Prabhnoor's Digital Garden"
├── package.json
├── vite.config.js      # base = '/'
├── netlify.toml
└── .github/workflows/deploy.yml
```

---

## App architecture

`App.jsx` is intentionally a single file. Do not break it up unless explicitly asked.

### The six tabs

| Tab ID | Label | Description |
|---|---|---|
| `dispatch` | The Plot | Daily reading list, date-navigable, seeded shuffle |
| `garden` | The Grove | D3 force graph, 8 theme bubbles, keyword edges |
| `paths` | Trails | Curated reading sequences with bookmark-tab navigation |
| `field` | The Field | Organisations mapped by stance, linked to articles |
| `stats` | Harvest | Reading progress by theme and type, notes review |
| `add` | Sow | Form to add custom sources to the pool |

### Root state (`App` component)
- `pool` — `BUILTIN` (68 hardcoded items, **do not edit**) + `customItems`
- `readItems` — Set of URLs marked read
- `notes` — `{ [url]: { argument, thoughts, quote } }`
- `customItems`, `hiddenIds`, `paths`, `orgs`, `orgLinks` — all persisted to Supabase
- `customThemeColors` — persisted to `localStorage` only

### Mobile
- `useIsMobile()` hook at the top of `App.jsx` — fires at `window.innerWidth < 680`
- Mobile gets `MobileTabStrip` below the top bar instead of the inline `TabBar`
- `GardenSidebar` and `OrgSidebar` render as bottom sheets on mobile (not right panels)
- Grove SVG stays full-width on mobile when sidebar opens

### Supabase tables
`read_items`, `notes`, `custom_items`, `hidden_items`, `paths`, `organisations`, `org_article_links`, `garden_meta` — all with RLS, users own their rows. The `PublicGardenPage` queries these tables without a user filter; whether it sees Prabhnoor's data depends on whether anon-read RLS policies are set (this is an **open issue** — verify in Supabase dashboard).

---

## What NOT to change

- `BUILTIN` array — the 68 hardcoded sources. Do not touch.
- D3 simulation logic in `GardenView` — fragile. The sim, forces, zoom, and drag are carefully tuned.
- The parchment colour palette (`#FAFAF8`, `#C2410C`, `#B45309`, `#1C1410`) — intentional design.
- `buildLinks()` returns `{ source: string_id, target: string_id, keywords: [] }`. After D3 simulation, `source`/`target` become node objects. Code that runs outside D3 (e.g. `FieldView`, `PathsView`) must compare against plain string IDs, not `.id` properties.

---

## Open items (as of 2026-05-17)

- **Custom domain** — `garden.prabhnoorkohli.fyi` — configure in Netlify dashboard when Prabhnoor is ready
- **Public page RLS** — verify anon-read policies on Supabase tables so `PublicGardenPage` shows Prabhnoor's notes/trails/orgs
- **Self-service formatting tool** — Prabhnoor wants to change font/layout herself without code; scoped to ~5 design tokens stored in `localStorage` or a settings table
- **Color scheme review** — intentionally deferred until other design work settled

---

## Developer notes (Harman's preferences)

- Fix precisely — don't refactor beyond the task, don't add abstractions the code doesn't need
- No trailing summaries in responses — the diff speaks for itself
- Mobile UX is important — always consider both breakpoints when changing layout
- Commit and push immediately after a fix is verified — don't leave changes uncommitted
- Run `source ~/.nvm/nvm.sh && nvm use 20` before any `npm` command on this machine
