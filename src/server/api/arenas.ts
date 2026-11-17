import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { type ArenaOwner, type ArenasService } from '@/server/arenas';
import { type AuthEnv } from '@/server/auth';
import { NotFoundError } from '@/server/errors';
import { arenaListSchema, arenaSchema } from '@/shared/api';

import { validationHook } from './problems';

const paramSchema = z.object({ id: z.uuid() });

/**
 * A malformed arena ID in the path is an address that points to nothing: 404,
 * not 422.
 */
const paramHook: Parameters<typeof zValidator>[2] = (result) => {
  if (!result.success) {
    throw new NotFoundError('There is no such arena.');
  }
};

/**
 * `/api/v1/arenas`. The owner always comes from the session, never from the
 * client.
 *
 * @param arenas - The arenas service.
 */
export function createArenasRoutes(arenas: ArenasService) {
  return new Hono<AuthEnv>()
    .get('/arenas', async (c) => {
      const items = await arenas.list(ownerOf(c.get('session')));
      return c.json(arenaListSchema.parse({ items }), 200);
    })
    .get(
      '/arenas/:id',
      zValidator('param', paramSchema, paramHook),
      async (c) => {
        const arena = await arenas.get(
          ownerOf(c.get('session')),
          c.req.valid('param').id,
        );
        return c.json(arenaSchema.parse(arena), 200);
      },
    )
    .put(
      '/arenas/:id',
      zValidator('param', paramSchema, paramHook),
      zValidator('json', arenaSchema, validationHook),
      async (c) => {
        const arena = c.req.valid('json');
        if (arena.id !== c.req.valid('param').id) {
          throw new NotFoundError('The arena ID does not match the path.');
        }
        await arenas.save(ownerOf(c.get('session')), arena);
        return c.body(null, 204);
      },
    )
    .delete(
      '/arenas/:id',
      zValidator('param', paramSchema, paramHook),
      async (c) => {
        await arenas.delete(ownerOf(c.get('session')), c.req.valid('param').id);
        return c.body(null, 204);
      },
    );
}

const ownerOf = ({
  me,
}: {
  me: { id: string; organizationId: string };
}): ArenaOwner => ({
  orgID: me.organizationId,
  userID: me.id,
});
