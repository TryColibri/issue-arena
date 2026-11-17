import { Hono } from 'hono';

import { type ArenasService } from '@/server/arenas';
import { type AuthEnv, type SessionGate } from '@/server/auth';
import { type LinearClient } from '@/server/linear';

import { createArenasRoutes } from './arenas';
import { createLinearRoutes } from './linear';
import { createMeRoutes } from './me';
import { createErrorHandler, notFoundHandler } from './problems';

export { problemResponse } from './problems';

/** Services the API calls. */
export type ApiDeps = {
  /** Gate that answers 401 without a valid session. */
  sessions: SessionGate;
  /** Linear's API. */
  linear: LinearClient;
  /** Arena persistence. */
  arenas: ArenasService;
  /** Called once with unexpected errors before answering 500. */
  onUnexpectedError: (error: unknown) => void;
};

/**
 * Creates the `/api/v1` app. Everything behind it needs a session. Routes
 * are chained so Hono's typed client can infer them from `ApiV1`.
 *
 * @param deps - Services the handlers call.
 */
export function createApiV1({
  sessions,
  linear,
  arenas,
  onUnexpectedError,
}: ApiDeps) {
  const app = new Hono<AuthEnv>()
    .use(sessions.require)
    .route('/', createMeRoutes())
    .route('/', createLinearRoutes(linear))
    .route('/', createArenasRoutes(arenas));
  app.onError(createErrorHandler(onUnexpectedError));
  app.notFound(notFoundHandler);
  return app;
}

/** Type of the `/api/v1` app, for `hc<ApiV1>`. */
export type ApiV1 = ReturnType<typeof createApiV1>;
