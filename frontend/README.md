# rustguac React frontend

Vite + React 19 + TypeScript SPA that replaces the legacy static UI under `../static/`. It talks to the **existing** Rust backend only via HTTP(S) and the same paths the static app used (`/api`, `/auth`, `/ws`).

## Prerequisites

- Node.js 20+ (LTS recommended)
- Running rustguac backend (default `http://127.0.0.1:8080`)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PROXY_TARGET` | No | Dev-server proxy target for `/api`, `/auth`, and `/ws`. Default: `http://127.0.0.1:8080`. Use `https://host:port` when the API is TLS-terminated elsewhere. |

Create `.env.local` in this directory (gitignored) for local overrides:

```env
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

Production builds **do not** embed the API base URL: deploy the built assets behind the same origin as the API (or a reverse proxy that forwards `/api`, `/auth`, `/ws`), matching how the static site was served.

On the **rustguac** server, set `ui_frontend = "spa"` in `config.toml` and copy the contents of `frontend/dist/` into `static_path` (merge with existing `static/guac` assets if needed). With `ui_frontend = "static"` (the default), the server keeps serving the legacy HTML pages only.

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173 with proxy to VITE_PROXY_TARGET
npm run build    # typecheck + output to dist/
npm run preview  # serve dist/ locally
```

## Auth

- **OIDC**: “Sign in” sends the browser to `/auth/login` (backend flow unchanged).
- **API key**: validated against the backend; stored in `sessionStorage` under `rustguac_api_key` (same key name as the legacy app).
- **Cookie session**: after OIDC, `GET /api/me` succeeds and the shell loads like the old pages.

## Guacamole client

`/client/:sessionId` loads `public/rustguac-session-client.js` and `public/guac/*` (same family of scripts as `static/client.html`). Cookies and relative `/api` calls behave like the legacy client page when served from the same origin as the gateway.

## Documentation

- [MIGRATION.md](./MIGRATION.md) — migration map from `static/`, feature parity checklist, and known differences.

## Project layout (high level)

- `src/api/` — Axios client, interceptors, typed service functions (mirror legacy fetch URLs and bodies).
- `src/pages/` — route-level screens (connections, sessions, recordings, reports, docs, tokens, admin, login, client).
- `src/features/connections/` — entry/folder/share/onboarding modals and entry form helpers.
- `src/components/` — shared UI (e.g. My Credentials modal).
- `src/stores/` — Zustand for API key and other client-only state.
- `public/` — Guacamole client assets and `rustguac.css` theme hooks.
