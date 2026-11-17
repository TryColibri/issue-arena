import { Hono } from 'hono';

import { type AuthEnv } from '@/server/auth';
import { meSchema } from '@/shared/api';

/** `GET /api/v1/me`: the signed-in user, straight from the session. */
export function createMeRoutes() {
  return new Hono<AuthEnv>().get('/me', (c) =>
    c.json(meSchema.parse(c.get('session').me), 200),
  );
}
