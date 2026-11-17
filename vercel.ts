import { routes, type VercelConfig } from '@vercel/config/v1';

/**
 * One Vercel project: Vite builds the SPA to `dist/`, which the CDN serves,
 * and `api/index.ts` is the single Node.js function behind every `/api` path.
 */
export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'pnpm build',
  outputDirectory: 'dist',
  rewrites: [
    routes.rewrite('/api/:path*', '/api'),
    // Client-side routes: everything that is not the API and not a file.
    routes.rewrite('/((?!api/).*)', '/index.html'),
  ],
};
