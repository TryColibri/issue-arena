import { type VercelConfig } from '@vercel/config/v1';

/**
 * One Vercel project that deploys a prebuilt Build Output API tree.
 * `pnpm build` writes `.vercel/output`: the SPA in `static/`, the bundled Hono
 * function in `functions/api.func/` and `config.json`, which holds the routes
 * (see `vite.server.config.ts`). Vercel runs no framework build of its own.
 */
export const config: VercelConfig = {
  framework: null,
  buildCommand: 'pnpm build',
};
