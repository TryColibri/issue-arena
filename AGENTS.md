# Issue Arena

Issue Arena turns prioritizing a Linear backlog into a workflow that works: the
user signs in with Linear, picks a scope (their issues, a state, a project, an
initiative, all issues, or a custom filter), and is shown **two issues at a
time**. Picking the more important of two is easy. Battles continue until the
**top N** issues are known, in order.

The ranking is **shown only**: nothing is ever written back to Linear, so the
app asks for the `read` OAuth scope only.

The implementation plan's decisions are settled; this file is the working
reference. Stack, layering, tooling, CI and coding standards come from
`TryColibri/mcp-decoy`. The look does not (see "Design").

---

# Tech stack

| Concern         | Choice                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape           | **One Vercel project**: a **Vite + React 19 + TypeScript SPA** on the CDN, and **one Hono app** as a single Node.js Vercel Function (Fluid Compute)                                                                         |
| Function entry  | `src/server/vercel.ts`, bundled with its dependencies into one `index.mjs` by `vite.server.config.ts` (Vite's Rolldown SSR build). Vercel runs no source file: `pnpm build` writes the whole deployment to `.vercel/output` |
| Vercel config   | `vercel.ts` (`@vercel/config`): `framework: null` and `buildCommand`. Routes live in the generated `.vercel/output/config.json`: `/api/(.*)` → function, then files, then SPA fallback → `/index.html`                      |
| Routes          | Everything the server answers lives under `/api`: `/api/auth/*` (OAuth) and `/api/v1/*` (REST)                                                                                                                              |
| Auth            | Linear OAuth (PKCE + `state`, `read` scope). Session = sealed cookie (`jose`, `dir` + `A256GCM`): `HttpOnly; SameSite=Lax`, `Secure` over HTTPS                                                                             |
| Persistence     | Arena state lives in `localStorage` (authoritative while playing), flushed asynchronously to **private Vercel Blob**. A failed flush is fine                                                                                |
| Linear          | GraphQL over `fetch` in `src/server/linear/`, every response parsed with Zod                                                                                                                                                |
| API             | REST under `/api/v1`, Zod schemas in `src/shared/api/` as the contract, `@hono/zod-validator`, RFC 9457 errors                                                                                                              |
| API client      | Hono's typed client (`hc`) in `src/shared/client/`                                                                                                                                                                          |
| SPA routing     | **React Router** as a client-side library (declarative mode). No framework mode, no SSR                                                                                                                                     |
| SPA data        | **`useSWR`** for reads; mutations with the typed client followed by SWR `mutate`                                                                                                                                            |
| Styling         | Tailwind CSS v4 (`@tailwindcss/vite`) utility classes, `@theme` tokens in `src/ui/styles.css`                                                                                                                               |
| UI primitives   | **Base UI** (`@base-ui/react`) for popovers, menus, checkboxes, …                                                                                                                                                           |
| Icons and fonts | `@phosphor-icons/react`; `@fontsource/geist` and `@fontsource/geist-mono` (bundled)                                                                                                                                         |
| Package manager | pnpm — always use `pnpm add`/`pnpm remove`, never edit dependencies in `package.json` directly. Exact versions                                                                                                              |
| Test runner     | Vitest (projects: `server` (node) for server and shared, `ui` (jsdom) for UI)                                                                                                                                               |
| Formatter       | oxfmt — `pnpm format:fix` to auto-format (or `pnpm fix` to format and lint together)                                                                                                                                        |
| Lint            | oxlint (type-aware via `oxlint-tsgolint`) — `pnpm lint` runs oxlint only; formatting is checked separately via `pnpm format`                                                                                                |
| Typecheck       | TypeScript 7, `tsc -b` over `tsconfig.server.json`, `tsconfig.ui.json` and `tsconfig.node.json`                                                                                                                             |
| Node            | `.nvmrc`; `engines.node` is `>=24`                                                                                                                                                                                          |

TypeScript 7 ships no editor plugin API. Install the dedicated **TypeScript 7**
extension (`TypeScriptTeam.native-preview`, recommended in
`.vscode/extensions.json`) for editor language support.

## Rules agents tend to break

- **Never use any TanStack package** (Query, Router, Table, …). Reads go through
  `useSWR`; routing through React Router.
- **No shadcn.** Interactive primitives come from Base UI, styled with Tailwind
  utility classes inline. No component library on top.
- **No Next.js, no React Router framework mode, no SSR.** The SPA is static
  files served by Vercel's CDN.
- **No OpenAPI.** The Zod schemas in `src/shared/api/` are the contract.
- **Never write to Linear.** No mutations, no scopes beyond `read`.
- **The client never sends raw GraphQL or raw `IssueFilter` JSON.** It sends the
  filter AST of `src/shared/api/issue-filter.ts`;
  `src/server/linear/compile-filter.ts` turns it into Linear's filter.
- **Org and user IDs come from the session, never from the client.** They name
  the blob keys.
- `src/ui/**` never imports `src/server/**`. `src/shared/**` imports nothing
  from either, except `src/shared/client/`, which may `import type` from
  `src/server/api/`. The oxlint config enforces this.
- Server runtime packages go in `dependencies`; everything compiled into the SPA
  (React, Router, SWR, Base UI, Tailwind, fonts, icons) is a `devDependency`.
- **No `!important`, no `as`, no `types.ts`**, no arbitrary design values: see
  "Design" and the coding standards.

---

# CI/CD philosophy

1. CI calls `package.json` scripts and may only extend them with flags. If a
   check needs different behavior, change the script, not the workflow. This is
   what keeps a green local run meaning the same thing as a green CI run.
2. `checks.yml` runs format, lint, typecheck, test and build in parallel. Pull
   request titles must be Conventional Commits (`pr-title.yml`). `main.yml` runs
   the checks only: **there is no release or publish step**. Vercel's Git
   integration deploys previews for pull requests and production for `main`.
3. Unit tests must not depend on ambient environment (network, clock, ports,
   environment variables). Pass them in.

---

# Architecture

## Runtime

```
browser (SPA)  ──/api/auth/*──▶  Hono (Vercel Function) ──▶ Linear OAuth + GraphQL
   │  localStorage (authoritative while playing)    │
   └──/api/v1/arenas (async, best effort) ─────────▶ ArenasService ──▶ private Vercel Blob
```

- **The ranking engine** is pure code in `src/shared/arena/`. It runs in the
  browser, so every battle is instant and works offline. The server uses it only
  to validate saved documents and to summarize arenas.
- **The server** handles OAuth and the session, a thin Zod-validated proxy to
  Linear, and arena persistence.
- **Layering follows MCP Decoy:** handlers validate, call one service function,
  then serialize. Services know nothing about HTTP.
- `src/server/app.ts` builds the app from injected dependencies (`createApp`):
  config, `fetch`, the arenas service. `src/server/vercel.ts` builds them from
  the environment; `src/server/dev.ts` does the same for `pnpm dev`. Tests build
  them with mocks.
- **Security middleware** (in `app.ts`): a mutating request needs
  `Content-Type: application/json` (POST/PUT/PATCH) and an `Origin` equal to the
  request's own origin, so previews work. The session cookie is
  `HttpOnly; SameSite=Lax`, plus `Secure` over HTTPS.
- **The session gate** (`src/server/auth/session.ts`) refreshes an expired
  Linear token and rewrites the cookie. A refusal answers 401 problem+json
  (carrying the cookie that clears the session) and the SPA shows "Connect
  Linear". Linear may rotate refresh tokens, so the SPA loads `/api/v1/me`
  before anything else: it is the request that renews.
- **Redirect URI** is `${requestOrigin}/api/auth/linear/callback`. Register the
  production domain and `http://localhost:5173` in the Linear OAuth app. Preview
  URLs cannot complete OAuth, because Linear needs exact URIs.

## Ranking engine (`src/shared/arena/`)

Threshold-first binary insertion, to find an ordered top N in as few battles as
possible:

- Candidates are processed in Linear order: priority (urgent to low, then none),
  then `sortOrder`. Strong issues come first, so weak ones are rejected in a
  single battle.
- While the top list has fewer than N items, each candidate is binary-inserted.
  Once full, a candidate first meets the current #N: a loser is discarded, a
  winner is binary-inserted into ranks 1…N-1 and the old #N drops out.
- Cost is about M + k·log₂N battles; the hard bound is M + M·⌈log₂N⌉.
- **State is an answer log.** An arena stores `candidates`, `n`, `scope`,
  `answers: {a, b, winner}[]`, `dropped: id[]`, `revision`, `updatedAt`.
  `replay()` rebuilds everything from it, deterministically. Answers are a set
  of pairwise judgments: when the algorithm needs to compare two issues it
  reuses the judgment, and otherwise that comparison is the next battle. So
  **undo** is removing the last used answer, **drop** is adding to `dropped`
  (and forgetting its answers), and validation is a consistency check, never a
  re-simulation.
- `nextBattle(arena) → {a, b} | null` (`null` means done), `answer`, `undo`,
  `drop`, `estimateBattles`, `validate`. All pure, no I/O. There are no ties:
  every battle needs a pick, and undo covers mistakes.

## Persistence

- **Browser** (`src/ui/arenas/use-arena.ts`): every answer, undo or drop writes
  the arena synchronously to `localStorage` (`issue-arena:arena:<id>`; each
  access in `try`/`catch`). A debounced `PUT /api/v1/arenas/:id` follows 1.5 s
  after the last change, and a `keepalive` `fetch` on `visibilitychange` /
  `pagehide`. Errors are swallowed; a failed flush shows a quiet "Not synced".
  On open, the copy with the higher `revision` wins.
- **Server** (`ArenasService` over `ArenaStore`): keys are
  `arenas/<orgId>/<userId>/<arenaId>/<revision padded to 8 digits>.json`,
  `access: 'private'`. Save puts the new revision, then best-effort deletes
  older ones, so reads never see a stale overwritten blob. A revision lower than
  or equal to the stored one is a 409, which the client ignores. Blob
  credentials come from OIDC on Vercel and `vercel env pull` locally; tests use
  `memory-store.ts`.

## Code layout

```
vercel.ts, vite.config.ts (SPA), vite.server.config.ts (function bundle), vitest.config.ts, tsconfig*.json, .oxlintrc.json, .oxfmtrc.json, oxlint-plugin.ts
src/
  shared/
    api/        # Zod schemas + types by resource: session, linear (pickers), issues, scope, issue-filter, arenas, problems
    arena/      # pure engine: replay, nextBattle, answer, undo, drop, estimateBattles, validate (+ tests)
    client/     # createIssueArenaClient(baseUrl) = hc<ApiV1>(`${baseUrl}/api/v1`)
  server/
    vercel.ts   # builds deps from env, exports the app
    dev.ts      # local @hono/node-server entry (:8787)
    app.ts      # createApp(deps): security middleware, /api/auth, /api/v1, /api 404 problem
    config/     # Zod-parsed env
    auth/       # Linear OAuth (PKCE + state), session gate and sealed cookie
    linear/     # LinearClient (GraphQL over fetch), compile-filter, excerpt
    arenas/     # ArenasService + ArenaStore; blob-store.ts (prod), memory-store.ts (tests)
    api/        # route modules (chained, `type ApiV1`): me, linear (pickers + search), arenas, problems
    errors.ts   # NotFoundError, ConflictError, ValidationError, UnauthorizedError, ForbiddenError, UpstreamError
  ui/
    index.html, main.tsx, app.tsx, styles.css, tw.ts, api.ts (SWR hooks + ApiError)
    theme/      # use-theme, theme-toggle
    arenas/     # localStorage + async flush: use-arena.ts, arena-storage.ts
    components/ # button, panel, kbd, avatar, issue-icons, issue-card, multi-select, logo
    routes/     # root-layout, home, custom-scope, setup, arena, results, not-found
```

Hono's typed client infers types only from **chained** route definitions. Write
route modules as one chain and export the app type (`type ApiV1`).

## Linear integration

- Scopes (`src/shared/api/scope.ts`) are a discriminated union: `my`, `backlog`,
  `todo`, `project`, `initiative`, `all`, `custom`. Every scope also excludes
  issues whose state type is `completed` or `canceled`.
- The custom filter is a small AST (`{ match: 'all' | 'any', conditions }`, at
  most 20 conditions). One condition per field: `team`, `status`, `assignee`,
  `creator`, `priority`, `label`, `project`, `initiative`, `cycle`, `estimate`,
  `dueDate`, `createdAt`, `updatedAt`, `title`. The compiler has a test per
  field and operator.
- `POST /api/v1/issues/search` (a POST only because a custom filter does not fit
  a query string; it is read-only) pages through Linear 100 at a time and stops
  at **500**, returning `{ items, truncated }`. The setup screen filters on the
  client and caps the arena at **150** issues, keeping the highest-priority
  ones.

---

# Design

**Brutalist, grayscale, quiet.** Flat planes, hairline rules, hard edges and
lots of white space (dark space in dark mode). Modern CSS and SVG keep it crisp
at full resolution, but none of that resolution is spent on ornament.

The hard rules are encoded as tokens in `src/ui/styles.css` and enforced by lint
where possible (`better-tailwindcss/no-restricted-classes`,
`no-unknown-classes`):

- **Grayscale only.** `--color-*` is reset, then one scale `gray-0` …
  `gray-1000` is defined. **Dark mode swaps the scale** under
  `html[data-theme='dark']`, so components use `gray-*` and never need `dark:`
  for color. Linear's state and label colors are not shown: state is a small
  grayscale SVG icon, priority a 3-bar meter (a filled square with `!` for
  urgent). Avatars are square and `grayscale`.
- **No rounded corners** (`--radius-*: initial`; `rounded-*` is banned).
- **No gradients** (`bg-linear-*`, `bg-radial-*`, `bg-conic-*`,
  `from-`/`via-`/`to-` are banned) and **no blur** (`blur-*`, `backdrop-blur-*`,
  `drop-shadow-*` are banned; the blur tokens are reset).
- **Shadows have no blur**: `shadow-hard` (4px), `shadow-hard-sm` (2px) and
  `shadow-hard-xs` (1px) are the only shadow tokens.
- **Type:** Geist for UI text and titles; Geist Mono for identifiers, counts,
  keycaps and metadata values, with `tabular-nums` wherever numbers update.
  Small uppercase mono labels only for section captions, sparingly.
- **Structure:** hierarchy comes from spacing and 1px rules, not boxes inside
  boxes. Metadata is a plain two-column grid (label | value). Icons are Phosphor
  at `size-4` and `size-5`.
- **Dropped, disabled and loading states** use solid gray fills and reduced
  contrast. Dropped issues also get a strikethrough. No patterns.
- **Interaction:** hover darkens the border to `gray-1000`; selected and active
  are **inverted** (`bg-gray-1000 text-gray-0`); pressed collapses the hard
  shadow by moving the element onto it; focus is a 2px solid outline with a 2px
  offset. Motion is about 100 ms on colors and transforms and uses
  `motion-safe:`, so there is none under `prefers-reduced-motion`.
- **Components:** `Button` (`variant`, `size`, `twMerge`, `ref`), `Panel`
  (`Panel.Header` / `Panel.Body`), `Kbd`, `IssueCard` (built on `Panel`),
  `MultiSelect` (Base UI popover of checkboxes).

---

# Coding standards

## Guiding principle

> Clear is better than clever.
>
> — Rob Pike, Go Proverbs

## Naming conventions

### Boolean variables

Use adjective-based names for `boolean` variables, not verb-based.

```ts
// correct
const hidden = true;
const outdated = false;
const closing = true;

// incorrect
const isHidden = true;
const shouldUpdate = false;
const willClose = true;
```

### Acronyms in camelCase and PascalCase

Put acronyms in all uppercase, except when the acronym starts a camelCase name.

```ts
// camelCase
(url, urlError, handleURL, encodeURLComponent, jsonSchema, parseYAML);

// PascalCase
(URL, URLHandler, EncryptedURL, JSONSchema, YAMLParser);

// incorrect
(handleUrl, createUrlHandler, JsonSchema, YamlParser);
```

## Functions

### Closures

When defining a closure inside a function body, prefer assigning an arrow
function to a `const` variable over a nested `function` declaration.

An inline arrow callback is fine when the whole callback is three lines or fewer
(counting the line that contains `=>` and any continuation lines), for example
in `filter`, `map`, `reduce`, or Vitest `expect` helpers. If it grows past that,
assign it to a `const` (or extract a named function) instead of inlining.

```ts
// correct — short enough to inline
function processItems(items: string[]) {
  return items.map((item: string) => item.trim().toLowerCase());
}

// correct — named when you want a stable reference or clearer call site
function processItems(items: string[]) {
  const format = (item: string) => item.trim().toLowerCase();
  return items.map(format);
}

// incorrect — nested function declaration
function processItems(items: string[]) {
  function format(item: string) {
    return item.trim().toLowerCase();
  }
  return items.map(format);
}
```

### Arguments & return types

When a function takes or returns an object, define it as a named type rather
than inlining the shape at the call site. Named types are easier to document,
reuse, and refactor.

```ts
// correct
type CreateUserParams = {
  name: string;
  email: string;
  role: "admin" | "student";
};

type CreateUserResult = {
  id: string;
  createdAt: Date;
};

function createUser(params: CreateUserParams): CreateUserResult { ... }

// incorrect
function createUser(params: {
  name: string;
  email: string;
  role: "admin" | "student";
}): { id: string; createdAt: Date } { ... }
```

Destructure object parameters in the function signature, not the body.

```ts
// correct
function createUser({ name, email, role }: CreateUserParams): CreateUserResult { ... }

// incorrect
function createUser(params: CreateUserParams): CreateUserResult {
  const { name, email, role } = params;
  ...
}
```

## Component composition

When a component accepts content that ends up in the DOM, accept it as
**children** (or as a named-slot subcomponent), not as a string prop. String
props that render into DOM elements are a leaky interface — the parent ends up
reaching across the primitive to customize a grandchild's text, icon, or class.

```tsx
// incorrect — leaky string props
<Button label="Start journey" icon={ArrowRightIcon} onClick={…} />
<Header title="Limits and continuity" />

// correct — children-based composition
<Button onClick={…}>
  <ArrowRightIcon size={15} weight="bold" />
  {t('startJourney')}
</Button>

<ChatPageShell.Header>
  <Title>{chapter.title}</Title>
</ChatPageShell.Header>
```

When composition gets complex enough to warrant explicit slots, use the
**named-slot subcomponent pattern**:

```tsx
<Shell>
  <Shell.Header>…</Shell.Header>
  <Shell.Sidebar>…</Shell.Sidebar>
  <Shell.Content>…</Shell.Content>
</Shell>
```

Slots are exposed as static properties on the parent (e.g.
`Shell.Header = function ShellHeader(…)`), and the parent inspects its children
— or simply renders the subcomponents in fixed positions — to lay them out.

Data-driven props are still fine where the content is intrinsically structured
(e.g. a list of chapters, a table of rows). Rendering each item via `children`
would push every caller into hand-rolling the same item markup, which is the
duplication this rule exists to prevent.

## Reusable components

Every reusable component (anything in `src/ui/components/`) must:

- accept `className` and merge it into the top-level element's classes with
  `twMerge` (from `tailwind-merge`), the caller's classes last so they win;
- accept `ref` and forward it to the top-level element. React 19 passes `ref` as
  a regular prop, so extend `ComponentProps<'tag'>` and spread the rest onto the
  element; no `forwardRef`.

## Type narrowing

Do not cast with `as`. Use type predicates (`value is Foo`) or type assertion
functions (`asserts value is Foo`) instead.

## Types and definitions

Do not create `types.ts` files. Define types close to their point of usage.

## Project structure

Organize files around feature concerns, not code categories. Prefer directories
named after what the code _does_ (`auth/`, `billing/`) over what it _is_
(`components/`, `hooks/`, `adapters/`).

### Source directory boundary

No source files live outside `src/`. Config and setup files (`*.config.ts`,
`vitest.setup.ts`, `oxlint-plugin.ts`, etc.) may remain at the repository root,
but all application source belongs under `src/server/`, `src/shared/` or
`src/ui/`.

## Documentation

Document exported TypeScript symbols with JSDoc. Document properties
individually on object types. Document function parameters. Add examples where
useful. Do not document unexported symbols.

## JSX

Keep JSX clean. Inline JavaScript is fine for simple expressions — string
interpolation, short ternaries, mapping a list to simple elements. When the
logic gets heavy, pull it out.

Two signals that logic belongs outside the JSX:

- It would span more than ~5 lines inside the expression.
- It produces nested component structure (conditionally rendered subtrees, lists
  of lists, etc.).

In those cases, extract a named `const` above the `return`, or a separate
component.

```tsx
// ✅ simple interpolation — fine inline
<p>Hello, {user.name}</p>

// ✅ short ternary — fine inline
<button>{loading ? 'Loading...' : 'Submit'}</button>

// ✅ list of simple elements — fine inline
<ul>
  {items.map((item) => (
    <li key={item.id}>{item.label}</li>
  ))}
</ul>

// ❌ conditional subtree with nesting — extract it
<div>
  {user.role === "admin" ? (
    <div>
      <h2>Admin panel</h2>
      <p>{user.email}</p>
      <button onClick={handleRevoke}>Revoke access</button>
    </div>
  ) : (
    <div>
      <h2>Member</h2>
      <p>{user.email}</p>
    </div>
  )}
</div>

// ✅ extracted — readable
const panel =
  user.role === "admin" ? (
    <AdminPanel email={user.email} onRevoke={handleRevoke} />
  ) : (
    <MemberPanel email={user.email} />
  );

return <div>{panel}</div>;
```

## CSS

Do not use `!important`.

## Icons

Size Phosphor icons with Tailwind `size-*` classes in `className`, never with
the numeric `size` prop.

```tsx
// correct
<TrashIcon className="size-4" aria-hidden="true" />

// incorrect
<TrashIcon size={16} aria-hidden="true" />
```

## Logging

Log levels:

- `error` — something went wrong, the program could not function correctly
- `warning` — functioned as expected, but something warrants attention
- `info` — the program did something as expected
- `debug` — extra detail, or "the program is about to do something"

Never emit an `error`-level log and then rethrow. Either handle the error or
throw it — not both. Logging before rethrowing causes duplicate log lines for
the same error and false positives when errors are caught higher in the stack.

## HTTP status codes

Use status codes that accurately reflect the nature of the failure, not just the
nearest approximation.

- **404 Not Found** — the addressed resource does not exist. This includes route
  parameters that are syntactically invalid (e.g. a server name that is not a
  valid slug): the URL simply points to nothing.
- **409 Conflict** — the request conflicts with existing state (e.g. a duplicate
  name).
- **415 Unsupported Media Type** — a mutating request without
  `Content-Type: application/json`.
- **422 Unprocessable Content** — the request body or query parameters fail
  validation. The problem details list every failing field in `errors`.
- **403 Forbidden** — the request was refused by the Origin check or the
  workspace allow-list.
- **401 Unauthorized** — there is no valid session. The SPA then shows "Connect
  Linear".
- **502 Bad Gateway** — Linear failed or answered with something unexpected.

The key distinction between 422 and 404 when parsing route parameters: if the
parameter is part of the URL path and its value makes no sense as a resource
identifier, the address is effectively non-existent — return 404, not 422.
Reserve 422 for problems with the request _body_ or query.

## JSON validation and serialization

Use Zod schemas at every JSON boundary. Parse untrusted input with the schema
after `JSON.parse` or `req.json()`. Run trusted output through the schema before
`JSON.stringify` or `Response.json()` — this validates shape and strips fields
the schema does not allow.

Infer TypeScript types with `z.infer<typeof …>`; do not maintain parallel
hand-written types for the same shape.

### Schema ownership

Who defines the schema depends on the boundary:

- **API endpoints** — `src/shared/api/` owns the Zod schemas and exported types
  for request and response bodies, grouped by resource. Handlers and clients
  import them from there; they do not redefine the shape.
- **Persisted documents** (arenas in Blob, arenas in `localStorage`) — the arena
  document is also an API body, so `src/shared/api/arenas.ts` owns its schema.
  The storage modules (`src/server/arenas/`, `src/ui/arenas/`) parse what they
  read with it; callers never parse or validate stored text themselves.

Validate all **incoming** JSON:

- API request bodies (through `@hono/zod-validator`)
- Everything Linear answers (`src/server/linear/`) and every stored arena

Serialize all **outgoing** JSON:

- API response bodies
- Arena documents written to Blob

```ts
// correct — validate after parse
const arena = arenaSchema.parse(JSON.parse(text));

// incorrect — trust parsed JSON
const arena = JSON.parse(text) as Arena;

// correct — serialize before responding
return c.json(arenaSummarySchema.parse(summary));
```

## Testing

### Test structure

Group tests by exported symbol, then by method or scenario, using nested
`describe` blocks. Each `it` block must be fully independent — no test may rely
on state left behind by a sibling.

```ts
describe('UserService', () => {
  describe('createUser', () => {
    it('creates a user with valid input', async () => { ... });
    it('throws when email is already taken', async () => { ... });
  });

  describe('deleteUser', () => {
    it('deletes an existing user', async () => { ... });
  });
});
```

Use `beforeEach` to produce a fresh instance or mock for every test. Use
`beforeAll`/`afterAll` only for expensive shared resources that are genuinely
read-only within the suite (e.g. a started server).

### Mocking in unit tests

Declare all `vi.mock()` calls at the top of the file, after all imports. Extract
mocked exports into named `const mock*` variables with `vi.mocked()`, then call
mock function methods on those variables. Prefer this over returning a mock
object from the `vi.mock` factory — it keeps setup close to the test and avoids
hidden state.

```ts
import { send } from './mailer';

vi.mock('./mailer');

const mockSend = vi.mocked(send);

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a welcome email on creation', async () => {
    mockSend.mockResolvedValueOnce({ messageId: 'abc' });

    await new UserService().createUser('a@b.com');

    expect(mockSend).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ to: 'a@b.com' }),
    );
  });
});
```

Rules:

- Use `mockDeep<T>()` from `vitest-mock-extended` only for class mocks, not
  plain objects or functions.
- Use `chainMock()` / `chainMocked()` from `chain-mock` for objects with
  chainable method APIs; do not use `vi.mocked()` for these.
- Extract mocked exports into `const mock*` variables with `vi.mocked()`; prefer
  calling mock function methods on those over returning a mock object from the
  `vi.mock` factory.
- Name mock variables with a `mock` prefix: `mockDB`, `mockClient`, `mockUser`.
- Call `vi.clearAllMocks()` in `beforeEach` to prevent state bleed between
  tests.
- Use `vi.useFakeTimers()` / `vi.useRealTimers()` in `beforeAll`/`afterAll` when
  the module under test uses `Date`, `setTimeout`, or `setInterval`.

### Assertions

Use `expect` from Vitest. Prefer the most specific matcher available — it
produces a better failure message than a generic `toBe(true)`.

```ts
// correct
expect(result).toEqual({ id: 1, name: 'Dan' });
expect(fn).toHaveBeenCalledExactlyOnceWith('arg');
await expect(promise).rejects.toThrow('error message');
expect(items).toHaveLength(3);
expect(str).toContain('substring');

// incorrect — prefer specific matchers
expect(result !== null).toBe(true);
expect(fn.mock.calls.length).toBe(1);
```

## Pagination

List endpoints that can grow without bound are paginated with **cursor-based
pagination** — never offset (`?page=` / `?offset=`). Issue Arena has none today:
`GET /api/v1/arenas` is one user's handful of arenas, and
`POST /api/v1/issues/search` is a bounded proxy (it stops at 500 issues and says
`truncated`). If a list ever needs paging, follow the rules below.

Cursors are an **API concern**. Route handlers own the full cursor lifecycle:
deserialize and validate incoming `cursor` query parameters, call the service
with the decoded cursor fields, then serialize `nextCursor` on the way out.
Services never accept or return opaque cursor strings — they take plain cursor
values (e.g. `beforeId`) that the handler extracted from a valid cursor.

```ts
// route handler — owns cursors
const beforeId = decodeCursor(rawCursor);
if (beforeId === null) {
  throw new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);
}
const items = logs.query({ server, beforeId, limit });

// service — owns the query, not the wire format
type LogQuery = {
  server: string;
  beforeId?: number;
  limit: number;
};
```

### Naming

- Request: `?cursor=<token>&limit=<n>` — omit `cursor` for the first page
- Response: `{ items: T[], nextCursor: string | null }` — `null` signals the
  last page

Clients **never construct cursors**. They only echo back what the server placed
in `nextCursor`. This makes inclusiveness, sort direction, and tie-breaking
invisible to the caller.

### Cursor encoding

Implement `encodeCursor` / `decodeCursor` next to the route handler (or in
colocated modules under the same route directory). Do not put cursor codecs in
services.

Encode cursors as a **fixed-width binary struct** serialized to `base64url` — no
JSON, no field names, no separators. Map each cursor field to a fixed byte range
(e.g. a `uint64` for an ID). Decode by reading the same offsets in reverse. This
keeps cursors short and opaque.

Example for a log entry `id` cursor:

```
[0..7]  uint64 big-endian — id of the last entry on the page
→ 8 bytes → 11 base64url chars
```

### Stability

When the sort key can have ties, include a secondary key in both the cursor and
the predicate.

## Git

Keep commit messages to a single line, maximum 80 characters.
