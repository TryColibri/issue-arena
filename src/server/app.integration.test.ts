import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type Arena,
  arenaListSchema,
  arenaSchema,
  type Issue,
  issueSearchResponseSchema,
  type Me,
  meSchema,
  optionListSchema,
  problemSchema,
  PROBLEM_TYPES,
} from '@/shared/api';

import { createApp } from './app';
import { createArenasService, createMemoryStore } from './arenas';
import { parseConfig } from './config';

const ORIGIN = 'https://arena.test';
const REDIRECT_URI = `${ORIGIN}/api/auth/linear/callback`;
const ARENA_ID = '11111111-1111-4111-8111-111111111111';

const ADA: Me = {
  id: 'user-ada',
  name: 'Ada',
  avatarUrl: null,
  organizationId: 'org-1',
  organizationName: 'Acme',
  organizationUrlKey: 'acme',
};
const BOB: Me = { ...ADA, id: 'user-bob', name: 'Bob' };

const CONFIG = parseConfig({
  LINEAR_CLIENT_ID: 'client-id',
  LINEAR_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'x'.repeat(32),
});

const linearIssue = (n: number) => ({
  id: `issue-${n}`,
  identifier: `ENG-${n}`,
  title: `Issue ${n}`,
  url: `https://linear.app/acme/issue/ENG-${n}`,
  priority: 2,
  priorityLabel: 'High',
  sortOrder: n,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'ENG' },
  assignee: { name: 'Ada', avatarUrl: null },
  project: null,
  labels: { nodes: [{ name: 'bug' }] },
  estimate: null,
  dueDate: null,
  description: `# Heading\n\nSome **bold** text for ${n}`,
});

const issue = (id: string): Issue => ({
  id,
  identifier: `T-${id}`,
  title: id,
  url: `https://linear.app/t/issue/T-${id}`,
  priority: 0,
  priorityLabel: 'None',
  sortOrder: 0,
  state: { name: 'Todo', type: 'unstarted' },
  teamKey: 'T',
  assignee: null,
  projectName: null,
  labels: [],
  estimate: null,
  dueDate: null,
  excerpt: '',
});

const arenaDocument = (overrides: Partial<Arena> = {}): Arena => ({
  id: ARENA_ID,
  scopeLabel: 'All issues',
  scope: { type: 'all' },
  n: 2,
  candidates: [issue('a'), issue('b'), issue('c')],
  answers: [],
  dropped: [],
  revision: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const bodyText = (init: RequestInit | undefined): string => {
  const body = init?.body;
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  return typeof body === 'string' ? body : '';
};

/** The pieces of Linear the tests steer. */
type FakeLinear = {
  /** Who `viewer` answers with. */
  viewer: Me;
  /** Issue pages served in order; the last repeats. Each has a `hasNextPage`. */
  issuePages: { nodes: unknown[]; hasNextPage: boolean }[];
  /** HTTP status of GraphQL calls, to simulate failures. */
  graphqlStatus: number;
  /** GraphQL errors to answer with. */
  graphqlErrors: { message: string; extensions?: { type: string } }[] | null;
  /** Whether the token endpoint accepts requests. */
  tokenOK: boolean;
};

type Cookies = Record<string, string>;

describe('app', () => {
  let linear: FakeLinear;
  let now: number;
  let tokenCalls: URLSearchParams[];
  let graphqlCalls: {
    query: string;
    variables: Record<string, unknown>;
    token: string | null;
  }[];
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let app: ReturnType<typeof createApp>;
  let unexpected: ReturnType<typeof vi.fn<(error: unknown) => void>>;

  const rebuild = (allowedOrgIDs: string[] = []) => {
    app = createApp({
      config: { ...CONFIG, allowedOrgIDs },
      fetch: fetchMock,
      arenas: createArenasService({ store: createMemoryStore() }),
      now: () => now,
      onUnexpectedError: unexpected,
    });
  };

  beforeEach(() => {
    now = Date.UTC(2026, 0, 1);
    tokenCalls = [];
    graphqlCalls = [];
    unexpected = vi.fn();
    linear = {
      viewer: ADA,
      issuePages: [
        { nodes: [linearIssue(1), linearIssue(2)], hasNextPage: false },
      ],
      graphqlStatus: 200,
      graphqlErrors: null,
      tokenOK: true,
    };
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === 'https://api.linear.app/oauth/token') {
        tokenCalls.push(new URLSearchParams(bodyText(init)));
        return linear.tokenOK
          ? Response.json({
              access_token: `at-${tokenCalls.length}`,
              refresh_token: `rt-${tokenCalls.length}`,
              expires_in: 3600,
            })
          : Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      if (url === 'https://api.linear.app/graphql') {
        const body = JSON.parse(bodyText(init)) as {
          query: string;
          variables: Record<string, unknown>;
        };
        const headers = new Headers(init?.headers);
        graphqlCalls.push({
          ...body,
          token: headers.get('authorization')?.replace('Bearer ', '') ?? null,
        });
        if (linear.graphqlStatus !== 200) {
          return Response.json({}, { status: linear.graphqlStatus });
        }
        if (linear.graphqlErrors !== null) {
          return Response.json({ errors: linear.graphqlErrors });
        }
        return Response.json({ data: graphqlData(body.query, body.variables) });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    rebuild();
  });

  const graphqlData = (query: string, variables: Record<string, unknown>) => {
    if (query.includes('query Viewer')) {
      return {
        viewer: {
          id: linear.viewer.id,
          name: linear.viewer.name,
          avatarUrl: linear.viewer.avatarUrl,
          organization: {
            id: linear.viewer.organizationId,
            name: linear.viewer.organizationName,
            urlKey: linear.viewer.organizationUrlKey,
          },
        },
      };
    }
    if (query.includes('query Issues')) {
      const pageIndex =
        graphqlCalls.filter((call) => call.query.includes('query Issues'))
          .length - 1;
      const page =
        linear.issuePages[Math.min(pageIndex, linear.issuePages.length - 1)];
      return {
        issues: {
          nodes: page.nodes,
          pageInfo: {
            hasNextPage: page.hasNextPage,
            endCursor: 'cursor',
          },
        },
      };
    }
    if (query.includes('teams(')) {
      return {
        teams: {
          nodes: [
            { id: 't2', name: 'Zeta', key: 'ZET' },
            { id: 't1', name: 'Alpha', key: 'ALP' },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    }
    if (query.includes('cycles(')) {
      return {
        cycles: {
          nodes: [{ id: 'c1', name: null, number: 7, team: { key: 'ALP' } }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    }
    void variables;
    throw new Error(`Unexpected query ${query}`);
  };

  const cookieHeader = (cookies: Cookies): string =>
    Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

  const readCookies = (response: Response, into: Cookies = {}): Cookies => {
    for (const header of response.headers.getSetCookie()) {
      const [pair = ''] = header.split(';');
      const [name = '', ...rest] = pair.split('=');
      const value = rest.join('=');
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(header) || value === '') {
        delete into[name];
      } else {
        into[name] = value;
      }
    }
    return into;
  };

  type Options = {
    method?: string;
    json?: unknown;
    cookies?: Cookies;
    headers?: Record<string, string>;
  };

  const call = async (
    path: string,
    { method = 'GET', json, cookies = {}, headers = {} }: Options = {},
  ) => {
    const mutating = method !== 'GET';
    return app.request(`${ORIGIN}${path}`, {
      method,
      headers: {
        ...(Object.keys(cookies).length > 0
          ? { cookie: cookieHeader(cookies) }
          : {}),
        ...(mutating ? { origin: ORIGIN } : {}),
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  };

  const expectProblem = async (
    response: Response,
    status: number,
    type: string,
  ) => {
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    const problem = problemSchema.parse(await response.json());
    expect(problem.type).toBe(type);
    return problem;
  };

  /** Runs the whole OAuth round trip and returns the session cookies. */
  const signIn = async (who: Me = ADA): Promise<Cookies> => {
    linear.viewer = who;
    const start = await call('/api/auth/linear/start');
    const cookies = readCookies(start);
    const state = new URL(start.headers.get('location') ?? '').searchParams.get(
      'state',
    );
    const callback = await call(
      `/api/auth/linear/callback?code=the-code&state=${state}`,
      { cookies },
    );
    expect(callback.headers.get('location')).toBe('/');
    return readCookies(callback);
  };

  describe('/api/auth', () => {
    describe('GET /linear/start', () => {
      it('redirects to Linear with PKCE, state and the read scope only', async () => {
        const response = await call('/api/auth/linear/start');
        expect(response.status).toBe(302);
        const location = new URL(response.headers.get('location') ?? '');
        expect(location.origin + location.pathname).toBe(
          'https://linear.app/oauth/authorize',
        );
        expect(Object.fromEntries(location.searchParams)).toMatchObject({
          client_id: 'client-id',
          redirect_uri: REDIRECT_URI,
          response_type: 'code',
          scope: 'read',
          code_challenge_method: 'S256',
        });
        expect(location.searchParams.get('state')).toBeTruthy();
      });

      it('keeps the verifier in a short-lived, HttpOnly cookie scoped to /api/auth', async () => {
        const response = await call('/api/auth/linear/start');
        const header = response.headers
          .getSetCookie()
          .find((c) => c.startsWith('ia_oauth='));
        expect(header).toMatch(/HttpOnly/i);
        expect(header).toMatch(/Secure/i);
        expect(header).toMatch(/SameSite=Lax/i);
        expect(header).toMatch(/Path=\/api\/auth/i);
        expect(header).toMatch(/Max-Age=600/i);
      });
    });

    describe('GET /linear/callback', () => {
      it('exchanges the code with the matching PKCE verifier and starts a session', async () => {
        const start = await call('/api/auth/linear/start');
        const challenge = new URL(
          start.headers.get('location') ?? '',
        ).searchParams.get('code_challenge');
        const state = new URL(
          start.headers.get('location') ?? '',
        ).searchParams.get('state');
        const response = await call(
          `/api/auth/linear/callback?code=abc&state=${state}`,
          {
            cookies: readCookies(start),
          },
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/');
        const exchange = tokenCalls[0];
        expect(exchange.get('grant_type')).toBe('authorization_code');
        expect(exchange.get('code')).toBe('abc');
        expect(exchange.get('client_secret')).toBe('client-secret');
        expect(exchange.get('redirect_uri')).toBe(REDIRECT_URI);
        expect(
          createHash('sha256')
            .update(exchange.get('code_verifier') ?? '')
            .digest('base64url'),
        ).toBe(challenge);
        const header = response.headers
          .getSetCookie()
          .find((c) => c.startsWith('ia_session='));
        expect(header).toMatch(/HttpOnly/i);
        expect(header).toMatch(/Secure/i);
        expect(header).toMatch(/SameSite=Lax/i);
      });

      it('does not put tokens in the cookie in the clear', async () => {
        const cookies = await signIn();
        expect(cookies.ia_session).not.toContain('at-1');
      });

      it('rejects a state that does not match', async () => {
        const start = await call('/api/auth/linear/start');
        const response = await call(
          '/api/auth/linear/callback?code=abc&state=forged',
          {
            cookies: readCookies(start),
          },
        );
        expect(response.headers.get('location')).toBe('/?error=state');
        expect(tokenCalls).toHaveLength(0);
        expect(readCookies(response).ia_session).toBeUndefined();
      });

      it('rejects a callback without the PKCE cookie', async () => {
        const response = await call(
          '/api/auth/linear/callback?code=abc&state=whatever',
        );
        expect(response.headers.get('location')).toBe('/?error=state');
      });

      it('sends the user home when they deny access', async () => {
        const response = await call(
          '/api/auth/linear/callback?error=access_denied',
        );
        expect(response.headers.get('location')).toBe('/?error=denied');
      });

      it('reports a failed token exchange without a session', async () => {
        linear.tokenOK = false;
        const start = await call('/api/auth/linear/start');
        const state = new URL(
          start.headers.get('location') ?? '',
        ).searchParams.get('state');
        const response = await call(
          `/api/auth/linear/callback?code=abc&state=${state}`,
          {
            cookies: readCookies(start),
          },
        );
        expect(response.headers.get('location')).toBe('/?error=failed');
        expect(readCookies(response).ia_session).toBeUndefined();
      });

      it('rejects workspaces outside the allow-list', async () => {
        rebuild(['some-other-org']);
        const start = await call('/api/auth/linear/start');
        const state = new URL(
          start.headers.get('location') ?? '',
        ).searchParams.get('state');
        const response = await call(
          `/api/auth/linear/callback?code=abc&state=${state}`,
          {
            cookies: readCookies(start),
          },
        );
        expect(response.headers.get('location')).toBe('/?error=workspace');
        expect(readCookies(response).ia_session).toBeUndefined();
      });

      it('accepts workspaces on the allow-list', async () => {
        rebuild(['org-1']);
        const cookies = await signIn();
        expect((await call('/api/v1/me', { cookies })).status).toBe(200);
      });
    });

    describe('POST /logout', () => {
      it('clears the session', async () => {
        const cookies = await signIn();
        const response = await call('/api/auth/logout', {
          method: 'POST',
          json: {},
          cookies,
        });
        expect(response.status).toBe(204);
        expect(
          readCookies(response, { ...cookies }).ia_session,
        ).toBeUndefined();
      });
    });
  });

  describe('security', () => {
    it('refuses mutating requests without an Origin', async () => {
      const cookies = await signIn();
      const response = await app.request(`${ORIGIN}/api/auth/logout`, {
        method: 'POST',
        headers: {
          cookie: cookieHeader(cookies),
          'content-type': 'application/json',
        },
        body: '{}',
      });
      await expectProblem(response, 403, PROBLEM_TYPES.forbidden);
    });

    it('refuses mutating requests from another origin', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/issues/search', {
        method: 'POST',
        json: { scope: { type: 'all' } },
        cookies,
        headers: { origin: 'https://evil.test' },
      });
      await expectProblem(response, 403, PROBLEM_TYPES.forbidden);
    });

    it('requires a JSON body on POST and PUT', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/issues/search', {
        method: 'POST',
        cookies,
        headers: { 'content-type': 'text/plain' },
      });
      await expectProblem(response, 415, PROBLEM_TYPES.unsupportedMediaType);
    });

    it('accepts the request own origin, which is what makes previews work', async () => {
      const preview = 'https://issue-arena-git-feature.vercel.app';
      const response = await app.request(`${preview}/api/auth/logout`, {
        method: 'POST',
        headers: { origin: preview, 'content-type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(204);
    });

    it('answers unknown API paths with a 404 problem', async () => {
      await expectProblem(await call('/api/nope'), 404, PROBLEM_TYPES.notFound);
    });
  });

  describe('GET /api/v1/me', () => {
    it('answers 401 problem+json without a session', async () => {
      await expectProblem(
        await call('/api/v1/me'),
        401,
        PROBLEM_TYPES.unauthorized,
      );
    });

    it('answers 401 for a forged cookie', async () => {
      const response = await call('/api/v1/me', {
        cookies: { ia_session: 'forged' },
      });
      await expectProblem(response, 401, PROBLEM_TYPES.unauthorized);
    });

    it('returns the signed-in user', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/me', { cookies });
      expect(response.status).toBe(200);
      expect(meSchema.parse(await response.json())).toEqual(ADA);
    });

    it('does not renew a fresh session', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/me', { cookies });
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(tokenCalls).toHaveLength(1);
    });

    it('renews an expired access token with the refresh token and rewrites the cookie', async () => {
      const cookies = await signIn();
      now += 2 * 60 * 60 * 1000;
      const response = await call('/api/v1/me', { cookies });
      expect(response.status).toBe(200);
      expect(tokenCalls[1].get('grant_type')).toBe('refresh_token');
      expect(tokenCalls[1].get('refresh_token')).toBe('rt-1');
      const renewed = readCookies(response, { ...cookies });
      expect(renewed.ia_session).not.toBe(cookies.ia_session);

      await call('/api/v1/teams', { cookies: renewed });
      expect(graphqlCalls.at(-1)?.token).toBe('at-2');
    });

    it('answers 401 and clears the cookie when the refresh fails', async () => {
      const cookies = await signIn();
      linear.tokenOK = false;
      now += 2 * 60 * 60 * 1000;
      const response = await call('/api/v1/me', { cookies });
      await expectProblem(response, 401, PROBLEM_TYPES.unauthorized);
      expect(readCookies(response, { ...cookies }).ia_session).toBeUndefined();
    });
  });

  describe('session renewal during a Linear outage', () => {
    it('answers 502 and keeps the session instead of logging the user out', async () => {
      const cookies = await signIn();
      now += 2 * 60 * 60 * 1000;
      fetchMock.mockImplementationOnce(
        async () => new Response('down', { status: 503 }),
      );
      const response = await call('/api/v1/me', { cookies });
      await expectProblem(response, 502, PROBLEM_TYPES.upstream);
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe('pickers', () => {
    it.each([
      'teams',
      'projects',
      'initiatives',
      'users',
      'labels',
      'states',
      'cycles',
    ])('GET /%s needs a session', async (kind) => {
      await expectProblem(
        await call(`/api/v1/${kind}`),
        401,
        PROBLEM_TYPES.unauthorized,
      );
    });

    it('GET /teams returns options sorted by name', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/teams', { cookies });
      expect(response.status).toBe(200);
      expect(optionListSchema.parse(await response.json()).items).toEqual([
        { id: 't1', name: 'Alpha', hint: 'ALP' },
        { id: 't2', name: 'Zeta', hint: 'ZET' },
      ]);
    });

    it('names unnamed cycles by number', async () => {
      const cookies = await signIn();
      const response = await call('/api/v1/cycles', { cookies });
      expect(optionListSchema.parse(await response.json()).items).toEqual([
        { id: 'c1', name: 'Cycle 7', hint: 'ALP' },
      ]);
    });
  });

  describe('POST /api/v1/issues/search', () => {
    const search = async (cookies: Cookies, scope: unknown) =>
      call('/api/v1/issues/search', {
        method: 'POST',
        json: { scope },
        cookies,
      });

    it('returns issues as snapshots with a plain-text excerpt', async () => {
      const cookies = await signIn();
      const response = await search(cookies, { type: 'my' });
      expect(response.status).toBe(200);
      const body = issueSearchResponseSchema.parse(await response.json());
      expect(body.truncated).toBe(false);
      expect(body.items[0]).toMatchObject({
        id: 'issue-1',
        identifier: 'ENG-1',
        teamKey: 'ENG',
        projectName: null,
        labels: ['bug'],
        excerpt: 'Heading Some bold text for 1',
      });
    });

    it('sends the compiled scope filter to Linear', async () => {
      const cookies = await signIn();
      await search(cookies, { type: 'project', projectId: 'p1' });
      const issuesCall = graphqlCalls.find((c) =>
        c.query.includes('query Issues'),
      );
      expect(issuesCall?.variables.filter).toEqual({
        and: [
          { state: { type: { nin: ['completed', 'canceled'] } } },
          { project: { id: { eq: 'p1' } } },
        ],
      });
    });

    it('pages through Linear 100 at a time and stops at 500, reporting truncation', async () => {
      const full = Array.from({ length: 100 }, (_, i) => linearIssue(i));
      linear.issuePages = [{ nodes: full, hasNextPage: true }];
      const cookies = await signIn();
      const response = await search(cookies, { type: 'all' });
      const body = issueSearchResponseSchema.parse(await response.json());
      expect(body.items).toHaveLength(500);
      expect(body.truncated).toBe(true);
      expect(
        graphqlCalls.filter((c) => c.query.includes('query Issues')),
      ).toHaveLength(5);
    });

    it('is not truncated when Linear has no more pages', async () => {
      linear.issuePages = [
        {
          nodes: Array.from({ length: 100 }, (_, i) => linearIssue(i)),
          hasNextPage: true,
        },
        { nodes: [linearIssue(100)], hasNextPage: false },
      ];
      const cookies = await signIn();
      const body = issueSearchResponseSchema.parse(
        await (await search(cookies, { type: 'all' })).json(),
      );
      expect(body.items).toHaveLength(101);
      expect(body.truncated).toBe(false);
    });

    it('rejects an invalid scope with field errors', async () => {
      const cookies = await signIn();
      const response = await search(cookies, { type: 'project' });
      const problem = await expectProblem(
        response,
        422,
        PROBLEM_TYPES.validation,
      );
      expect(problem.errors?.length).toBeGreaterThan(0);
    });

    it('rejects raw GraphQL smuggled into a custom filter', async () => {
      const cookies = await signIn();
      const response = await search(cookies, {
        type: 'custom',
        filter: {
          match: 'all',
          conditions: [{ field: 'raw', operator: 'is', ids: ['x'] }],
        },
      });
      await expectProblem(response, 422, PROBLEM_TYPES.validation);
    });

    it('rejects more than 20 conditions', async () => {
      const cookies = await signIn();
      const conditions = Array.from({ length: 21 }, () => ({
        field: 'title',
        operator: 'contains',
        value: 'x',
      }));
      const response = await search(cookies, {
        type: 'custom',
        filter: { match: 'all', conditions },
      });
      await expectProblem(response, 422, PROBLEM_TYPES.validation);
    });

    it('answers 401 when Linear rejects the token', async () => {
      const cookies = await signIn();
      linear.graphqlStatus = 401;
      await expectProblem(
        await search(cookies, { type: 'all' }),
        401,
        PROBLEM_TYPES.unauthorized,
      );
    });

    it('answers 401 for a GraphQL authentication error', async () => {
      const cookies = await signIn();
      linear.graphqlErrors = [
        { message: 'no', extensions: { type: 'authentication error' } },
      ];
      await expectProblem(
        await search(cookies, { type: 'all' }),
        401,
        PROBLEM_TYPES.unauthorized,
      );
    });

    it('answers 502 when Linear fails', async () => {
      const cookies = await signIn();
      linear.graphqlStatus = 500;
      await expectProblem(
        await search(cookies, { type: 'all' }),
        502,
        PROBLEM_TYPES.upstream,
      );
    });

    it('answers 502 for a response of an unexpected shape', async () => {
      linear.issuePages = [{ nodes: [{ id: 1 }], hasNextPage: false }];
      const cookies = await signIn();
      await expectProblem(
        await search(cookies, { type: 'all' }),
        502,
        PROBLEM_TYPES.upstream,
      );
    });
  });

  describe('/api/v1/arenas', () => {
    const put = async (cookies: Cookies, arena: Arena, id = arena.id) =>
      call(`/api/v1/arenas/${id}`, { method: 'PUT', json: arena, cookies });

    it('needs a session', async () => {
      await expectProblem(
        await call('/api/v1/arenas'),
        401,
        PROBLEM_TYPES.unauthorized,
      );
    });

    it('saves, loads, lists and deletes an arena', async () => {
      const cookies = await signIn();
      expect((await put(cookies, arenaDocument())).status).toBe(204);

      const loaded = await call(`/api/v1/arenas/${ARENA_ID}`, { cookies });
      expect(loaded.status).toBe(200);
      expect(arenaSchema.parse(await loaded.json())).toEqual(arenaDocument());

      const listed = await call('/api/v1/arenas', { cookies });
      expect(arenaListSchema.parse(await listed.json()).items).toEqual([
        expect.objectContaining({
          id: ARENA_ID,
          candidateCount: 3,
          answered: 0,
          done: false,
        }),
      ]);

      const deleted = await call(`/api/v1/arenas/${ARENA_ID}`, {
        method: 'DELETE',
        cookies,
      });
      expect(deleted.status).toBe(204);
      await expectProblem(
        await call(`/api/v1/arenas/${ARENA_ID}`, { cookies }),
        404,
        PROBLEM_TYPES.notFound,
      );
    });

    it('answers 409 for a revision that is not newer', async () => {
      const cookies = await signIn();
      await put(cookies, arenaDocument({ revision: 3 }));
      await expectProblem(
        await put(cookies, arenaDocument({ revision: 3 })),
        409,
        PROBLEM_TYPES.conflict,
      );
    });

    it('answers 422 for an inconsistent arena', async () => {
      const cookies = await signIn();
      const response = await put(
        cookies,
        arenaDocument({ answers: [{ a: 'a', b: 'ghost', winner: 'a' }] }),
      );
      const problem = await expectProblem(
        response,
        422,
        PROBLEM_TYPES.validation,
      );
      expect(problem.errors).toContainEqual(
        expect.objectContaining({ path: 'answers.0.b' }),
      );
    });

    it('answers 422 for a body that does not match the schema', async () => {
      const cookies = await signIn();
      const response = await call(`/api/v1/arenas/${ARENA_ID}`, {
        method: 'PUT',
        json: { id: ARENA_ID },
        cookies,
      });
      await expectProblem(response, 422, PROBLEM_TYPES.validation);
    });

    it('answers 404 when the path ID differs from the body ID', async () => {
      const cookies = await signIn();
      const other = '22222222-2222-4222-8222-222222222222';
      await expectProblem(
        await put(cookies, arenaDocument(), other),
        404,
        PROBLEM_TYPES.notFound,
      );
    });

    it('answers 404 for an ID that is not a UUID', async () => {
      const cookies = await signIn();
      await expectProblem(
        await call('/api/v1/arenas/not-a-uuid', { cookies }),
        404,
        PROBLEM_TYPES.notFound,
      );
    });

    it('shows each user only their own arenas', async () => {
      const ada = await signIn(ADA);
      await put(ada, arenaDocument());
      const bob = await signIn(BOB);

      expect(
        arenaListSchema.parse(
          await (await call('/api/v1/arenas', { cookies: bob })).json(),
        ).items,
      ).toEqual([]);
      await expectProblem(
        await call(`/api/v1/arenas/${ARENA_ID}`, { cookies: bob }),
        404,
        PROBLEM_TYPES.notFound,
      );
      expect(
        (
          await call(`/api/v1/arenas/${ARENA_ID}`, {
            method: 'DELETE',
            cookies: bob,
          })
        ).status,
      ).toBe(204);
      expect(
        (await call(`/api/v1/arenas/${ARENA_ID}`, { cookies: ada })).status,
      ).toBe(200);
    });
  });

  it('reports unexpected errors once and answers a generic 500', async () => {
    const cookies = await signIn();
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('boom: secret detail');
    });
    const response = await call('/api/v1/issues/search', {
      method: 'POST',
      json: { scope: { type: 'all' } },
      cookies,
    });
    const problem = await expectProblem(response, 500, PROBLEM_TYPES.internal);
    expect(problem.detail).not.toContain('secret');
    expect(unexpected).toHaveBeenCalledOnce();
  });
});
