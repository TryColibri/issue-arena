import { createApp } from '@/server/app';
import { createBlobStore, createArenasService } from '@/server/arenas';
import { parseConfig } from '@/server/config';

/**
 * The deployed app: built once per function instance from the environment,
 * with Linear reached over the network and arenas stored in private Vercel
 * Blob. `vite.server.config.ts` bundles it into the Vercel function, which
 * calls its `fetch`.
 */
export default createApp({
  config: parseConfig(process.env),
  fetch,
  arenas: createArenasService({ store: createBlobStore() }),
  onUnexpectedError: (error) => {
    console.error('Unexpected error', error);
  },
});
