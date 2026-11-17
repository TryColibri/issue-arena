import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('./', import.meta.url));

/** The function's directory, relative to `.vercel/output`. */
const functionDir = 'functions/api.func';

/**
 * Writes the two files of the Vercel Build Output API that the bundle needs:
 * the function's `.vc-config.json` and the deployment's `config.json`, which
 * sends `/api/*` to the function and every other unknown path to the SPA.
 */
function vercelOutput(): Plugin {
  return {
    name: 'vercel-output',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: `${functionDir}/.vc-config.json`,
        source: JSON.stringify({
          runtime: 'nodejs24.x',
          handler: 'index.mjs',
          launcherType: 'Nodejs',
          supportsResponseStreaming: true,
        }),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'config.json',
        source: JSON.stringify({
          version: 3,
          routes: [
            { src: '/api/(.*)', dest: '/api' },
            { handle: 'filesystem' },
            { src: '/(.*)', dest: '/index.html' },
          ],
        }),
      });
    },
  };
}

/**
 * Bundles the Hono app (`src/server/vercel.ts`) and every dependency into the
 * single file Vercel runs, so the function needs no `src/` tree, no `@/`
 * alias and no file extensions at runtime. `pnpm build` runs this after the
 * SPA build, which fills `.vercel/output/static`.
 */
export default defineConfig({
  root,
  plugins: [vercelOutput()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/server/vercel.ts',
    outDir: '.vercel/output',
    // The SPA build owns `.vercel/output/static`; do not wipe it.
    emptyOutDir: false,
    target: 'node24',
    rolldownOptions: {
      output: {
        format: 'esm',
        entryFileNames: `${functionDir}/index.mjs`,
        // One file: the function is easier to reason about and cold-starts
        // from a single read.
        codeSplitting: false,
      },
    },
  },
});
