# Issue Arena

Rank your Linear issues by picking between two. Sign in with Linear, choose a
scope (your issues, a state, a project, an initiative, everything, or a custom
filter), and choose the more important of two issues at a time until the top N
are known, in order. The result is shown, never written back: the app asks for
Linear's `read` scope only.

- **Fast:** the ranking engine runs in the browser. Every battle is instant and
  works offline.
- **Few battles:** threshold-first binary insertion needs about M + k·log₂N
  battles for M issues and a top N. The setup screen shows the estimate.
- **Private:** each person sees only their own arenas.
- **Keyboard first:** `←` / `→` to pick, `U` to undo, `D` then a side to drop an
  issue that should not compete.

## Develop

```sh
nvm use            # Node >= 24
pnpm install
cp .env.example .env.local   # then fill it in, see below
pnpm dev           # API on :8787, Vite on :5173
```

Open <http://localhost:5173>. Without Blob credentials in `.env.local`, arenas
are kept in memory by the dev server; the browser's `localStorage` still
persists them across reloads.

| Script           | What it does                                      |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | API (`tsx watch`) and Vite together               |
| `pnpm build`     | `vite build` to `dist/`                           |
| `pnpm format`    | check formatting (`pnpm format:fix` to fix)       |
| `pnpm lint`      | oxlint, type-aware (`pnpm lint:fix` to fix)       |
| `pnpm typecheck` | `tsc -b`                                          |
| `pnpm test`      | Vitest: `server` (node) and `ui` (jsdom) projects |

CI runs exactly these scripts. Read `AGENTS.md` before changing anything.

## Configuration

| Variable                 | Required | What                                                                       |
| ------------------------ | -------- | -------------------------------------------------------------------------- |
| `LINEAR_CLIENT_ID`       | yes      | Client ID of your Linear OAuth app                                         |
| `LINEAR_CLIENT_SECRET`   | yes      | Its client secret                                                          |
| `SESSION_SECRET`         | yes      | At least 32 random characters (`openssl rand -base64 32`)                  |
| `ALLOWED_LINEAR_ORG_IDS` | no       | Comma-separated Linear workspace IDs allowed to sign in. Empty allows all  |
| `BLOB_READ_WRITE_TOKEN`  | locally  | Private Blob store. On Vercel the function authenticates with OIDC instead |

### Linear OAuth app

Create one at <https://linear.app/settings/api/applications/new> and register
these callback URLs, exactly:

- `http://localhost:5173/api/auth/linear/callback`
- `https://<your-production-domain>/api/auth/linear/callback`

**Preview deployments cannot complete the sign-in.** Linear needs exact callback
URLs, and every preview has its own. Test OAuth locally or on production.

## Deploy (Vercel)

One Vercel project: Vite builds the SPA to `dist/`, which the CDN serves, and
`api/index.ts` is the single Node.js function behind `/api/*` (see `vercel.ts`).
Vercel's Git integration deploys previews for pull requests and production for
`main`.

1. `vercel link`.
2. Create a **private Blob store** and connect it to the project.
3. Add `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `SESSION_SECRET` and (to
   limit sign-ins to your workspace) `ALLOWED_LINEAR_ORG_IDS`.
4. Turn on **Deployment Protection → Vercel Authentication for all
   deployments**, production included, so only your Vercel team can open the
   app. If your plan cannot protect production, `ALLOWED_LINEAR_ORG_IDS` is the
   gate.
5. Deploy a preview, then production.

After the first production deploy, check that: the URL redirects to Vercel's
login when signed out; the OAuth round trip works; a deep link like
`/arenas/<id>` loads the SPA; `GET /api/v1/me` without a session answers 401
`problem+json`; and objects appear under `arenas/<org>/<user>/` in the Blob
dashboard.

## How it works

See `AGENTS.md`: architecture, the ranking engine, persistence, the Linear
integration, and the design rules.
