import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { type AuthEnv } from '@/server/auth';
import { type LinearClient, type OptionKind } from '@/server/linear';
import {
  issueSearchRequestSchema,
  issueSearchResponseSchema,
  optionListSchema,
} from '@/shared/api';

import { validationHook } from './problems';

/**
 * The read-only proxy to Linear: pickers for scopes and filters, and issue
 * search.
 *
 * Search is a POST only because a custom filter does not fit a query string;
 * it changes nothing. It is a bounded proxy, not an unbounded list: it pages
 * through Linear 100 at a time and stops at `MAX_SEARCH_ISSUES`, so it is not
 * cursor-paginated.
 *
 * @param linear - The Linear client.
 */
export function createLinearRoutes(linear: LinearClient) {
  const list = async (kind: OptionKind, token: string) =>
    optionListSchema.parse({ items: await linear.options(token, kind) });

  return new Hono<AuthEnv>()
    .get('/teams', async (c) =>
      c.json(await list('teams', c.get('session').accessToken), 200),
    )
    .get('/projects', async (c) =>
      c.json(await list('projects', c.get('session').accessToken), 200),
    )
    .get('/initiatives', async (c) =>
      c.json(await list('initiatives', c.get('session').accessToken), 200),
    )
    .get('/users', async (c) =>
      c.json(await list('users', c.get('session').accessToken), 200),
    )
    .get('/labels', async (c) =>
      c.json(await list('labels', c.get('session').accessToken), 200),
    )
    .get('/states', async (c) =>
      c.json(await list('states', c.get('session').accessToken), 200),
    )
    .get('/cycles', async (c) =>
      c.json(await list('cycles', c.get('session').accessToken), 200),
    )
    .post(
      '/issues/search',
      zValidator('json', issueSearchRequestSchema, validationHook),
      async (c) => {
        const { scope } = c.req.valid('json');
        const result = await linear.searchIssues(
          c.get('session').accessToken,
          scope,
        );
        return c.json(issueSearchResponseSchema.parse(result), 200);
      },
    );
}
