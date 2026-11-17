import { serve } from '@hono/node-server';

import { createApp } from '@/server/app';
import {
  createArenasService,
  createBlobStore,
  createMemoryStore,
} from '@/server/arenas';
import { parseConfig } from '@/server/config';

const PORT = 8787;

// Local development: Blob when its credentials are in `.env.local` (from
// `vercel env pull`), memory otherwise, so the app works with no setup.
const blobConfigured =
  process.env.BLOB_READ_WRITE_TOKEN !== undefined ||
  process.env.VERCEL_OIDC_TOKEN !== undefined;

const app = createApp({
  config: parseConfig(process.env),
  fetch,
  arenas: createArenasService({
    store: blobConfigured ? createBlobStore() : createMemoryStore(),
  }),
  onUnexpectedError: (error) => {
    console.error('Unexpected error', error);
  },
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.info(
    `API on http://localhost:${PORT} (${blobConfigured ? 'Blob' : 'in-memory'} arenas)`,
  );
});
