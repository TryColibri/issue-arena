import { Hono, type MiddlewareHandler } from 'hono';

import { createApiV1 } from '@/server/api';
import { createErrorHandler, problemResponse } from '@/server/api/problems';
import { type ArenasService } from '@/server/arenas';
import {
  createAuthRoutes,
  createLinearOAuth,
  createSessionGate,
} from '@/server/auth';
import { type Config } from '@/server/config';
import { createLinearClient, type LinearClient } from '@/server/linear';
import { PROBLEM_TYPES } from '@/shared/api';

/** Everything the app needs from the outside world. */
export type AppDeps = {
  /** Parsed environment. */
  config: Config;
  /** Network access, so tests can mock Linear. */
  fetch: typeof fetch;
  /** Arena persistence. */
  arenas: ArenasService;
  /** Overrides the Linear client built from `fetch`. For tests. */
  linear?: LinearClient;
  /** Clock, in epoch milliseconds. Default: `Date.now`. */
  now?: () => number;
  /** Called once with unexpected errors before answering 500. */
  onUnexpectedError: (error: unknown) => void;
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Creates the server app: security middleware, `/api/auth` (OAuth),
 * `/api/v1` (REST) and a 404 problem for any other `/api` path. The built SPA
 * is not served here: on Vercel the CDN serves it.
 *
 * @param deps - Config, network, persistence and error reporting.
 */
export function createApp({
  config,
  fetch: request,
  arenas,
  linear = createLinearClient({ fetch: request }),
  now = Date.now,
  onUnexpectedError,
}: AppDeps) {
  const oauth = createLinearOAuth({
    clientID: config.linearClientID,
    clientSecret: config.linearClientSecret,
    fetch: request,
    now,
  });
  const sessions = createSessionGate({
    secret: config.sessionSecret,
    oauth,
    now,
  });

  const app = new Hono();
  app.use('/api/*', csrfCheck);
  app.route(
    '/api/auth',
    createAuthRoutes({
      secret: config.sessionSecret,
      oauth,
      linear,
      sessions,
      allowedOrgIDs: config.allowedOrgIDs,
    }),
  );
  app.route(
    '/api/v1',
    createApiV1({ sessions, linear, arenas, onUnexpectedError }),
  );
  app.all('/api/*', (c) =>
    problemResponse({
      type: PROBLEM_TYPES.notFound,
      title: 'Not found',
      status: 404,
      detail: `No route for ${c.req.method} ${c.req.path}`,
    }),
  );
  app.onError(createErrorHandler(onUnexpectedError));
  return app;
}

/**
 * CSRF protection for mutating requests: the `Origin` must be the request's
 * own origin (so preview deployments work), and bodies must be JSON, which
 * browsers cannot send cross-origin without a preflight.
 */
const csrfCheck: MiddlewareHandler = async (c, next) => {
  if (!MUTATING_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const origin = c.req.header('origin');
  if (origin !== new URL(c.req.url).origin) {
    return problemResponse({
      type: PROBLEM_TYPES.forbidden,
      title: 'Forbidden',
      status: 403,
      detail: 'Mutating requests must come from this site.',
    });
  }
  const contentType = c.req.header('content-type') ?? '';
  if (
    BODY_METHODS.has(c.req.method) &&
    !/^application\/json\s*(;|$)/i.test(contentType)
  ) {
    return problemResponse({
      type: PROBLEM_TYPES.unsupportedMediaType,
      title: 'Unsupported media type',
      status: 415,
      detail:
        'Send the request body as JSON with Content-Type: application/json.',
    });
  }
  await next();
};
