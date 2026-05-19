# Migration: static → React (`frontend/`)

This document maps the legacy **static** frontend (`../static/`) to the new SPA and records parity expectations. The **Rust backend is unchanged**; all paths and payloads follow the same contracts as the HTML/JS version.

## Choosing the UI on the server

The binary reads `ui_frontend` from `config.toml`:

- **`static`** (default): serves the legacy `.html` pages from `static_path` and the standalone Guacamole page at `/client/{session_id}`.
- **`spa`**: serves the Vite/React build from `static_path` (`index.html` + `assets/`), with SPA fallback and redirects from old `*.html` URLs to the React routes.

Copy `frontend/dist/*` into `static_path` (alongside `guac/` and other assets) before enabling `spa`. Docker does this automatically; see the root `README.md`.

## Source → destination map

| Legacy | React route | Notes |
|--------|-------------|--------|
| `static/index.html` | `/` (`LoginPage`) | OIDC redirect, API key form, `?sso_error` handling |
| `static/connections.html` | `/connections` | Address book, connect, share, admin actions, vault/me gating, onboarding, `?credentials=1`, `?tour=1` |
| `static/sessions.html` | `/sessions` | List, connect, shadow, delete, ad-hoc session |
| `static/recordings.html` | `/recordings` | List, sort, player chain, download, delete |
| `static/reports.html` | `/reports` | Summary, paginated history, filters, top tables, CSV export |
| `static/docs.html` | `/docs` | `/api/docs` HTML, sidebar, hash navigation |
| `static/tokens.html` | `/tokens` | API keys for OIDC users |
| `static/admin.html` | `/admin` | Status, users, groups, admin tokens, audits |
| `static/client.html` | `/client/:sessionId` (`ClientPage`) | Still driven by `public/rustguac-session-client.js` + `public/guac/*` |

Shared styling reference: `public/rustguac.css` (copied from the static theme pipeline). Page-specific legacy CSS is ported where needed (e.g. connections, recordings).

## Architecture choices

- **React Router** — deep links and refresh on each route; authenticated layout wraps all app pages except login and raw client.
- **TanStack Query** — server state, retries where the old code retried (e.g. address book dependency errors).
- **Zustand** — API key in `sessionStorage` (legacy-compatible key).
- **Axios** — central client with credentials and error parsing aligned to legacy `fetch` error handling.
- **React Hook Form + Zod** — login and other forms where validation was formalized.
- **Tailwind CSS** — utility layout; CSS variables from `rustguac.css` preserve theme/accent behavior.

## Feature parity checklist

Use this when verifying a release against a running backend.

### Global / shell

- [ ] Theme presets from `/api/auth/status` apply (`initThemeFromPayload` / localStorage `rustguac_theme`).
- [ ] Nav links match role gating (admin, poweruser/operator features, API key bypass where legacy allowed).
- [ ] Logout clears session via backend and returns to `/`.
- [ ] “My Credentials” / “Welcome Tour” navigate to connections with query flags; modal opens and params are stripped.

### Login (`/`)

- [ ] OIDC enabled: primary button goes to `/auth/login`.
- [ ] OIDC disabled: API key form shown; invalid key shows error.
- [ ] Valid session cookie: auto-redirect to `/connections`.
- [ ] `?sso_error` shows failure message and clears query.

### Connections (`/connections`)

- [ ] Folder tree: scopes, expand/collapse, lazy subfolders, persistence of expanded/selected keys.
- [ ] Entries table: sort, connect, edit, clone, delete (per permissions).
- [ ] Connect: credential prompt when `prompt_credentials` / missing stored creds (non-web/non-vdi); success opens `client_url` in new tab with `name` query.
- [ ] **412** missing variables: error text + My Credentials flow.
- [ ] Share modal; folder create/rename/delete; entry modal (all protocols, jump hosts, drive, web URL rewrite note).
- [ ] Active sessions strip + VDI dormant reconnect behavior.
- [ ] Search: index + open entry/folder from search.
- [ ] Vault: blocked UI when `vault_enabled` and not `vault_configured`; address book **503** retry messaging.
- [ ] Onboarding modal and `localStorage` dismiss key `rustguac_onboarding_dismissed`.

### Sessions (`/sessions`)

- [ ] List sessions; connect/shadow/delete actions.
- [ ] Ad-hoc connect form matches backend fields and success navigation.

### Recordings (`/recordings`)

- [ ] List refresh / polling behavior.
- [ ] Sort columns; Guacamole recording playback chain; authenticated download; delete.

### Reports (`/reports`)

- [ ] Summary + paginated history; client filter/sort on current page.
- [ ] Top connections / top users widgets.
- [ ] CSV export (same query param pattern as legacy when using `user` / `key`).
- [ ] Redirect when not poweruser and no API key (aligned with `fetchMe` + role checks).

### Docs (`/docs`)

- [ ] Loads `/api/docs`; sidebar + in-page anchors; `history` / hash sync.

### Tokens (`/tokens`)

- [ ] OIDC-only messaging; list/create/revoke.

### Admin (`/admin`)

- [ ] System status; users; group mappings; admin tokens; audits (per backend permissions).

### Client (`/client/:sessionId`)

- [ ] WebSocket ticket flow; tunnel connect; same asset stack as legacy `client.html`.

## Known differences (not bugs by default)

1. **Navigation** — SPA client-side routing instead of full HTML document loads; URLs are aligned (`/connections` vs `connections.html` only if you configure the host to rewrite; default dev server uses path routes).
2. **Exact pixel parity** — layout uses Tailwind + variables; minor spacing/font rendering may differ from the monolithic `connections.html` layout while preserving the same controls and order.
3. **Wildcard route** — unknown paths redirect to `/connections` (authenticated) or login layout per router; legacy may have 404’d on missing files.

## If something is missing

Compare with the behavior in `../static/<page>.html` and the inline scripts there, then trace the matching function in `frontend/src/api/services.ts` and the corresponding page component. Do not change backend contracts without a coordinated API change.
