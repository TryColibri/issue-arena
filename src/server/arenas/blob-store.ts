import { del, get, list, put } from '@vercel/blob';

import { type ArenaStore } from './store';

/**
 * An `ArenaStore` over a private Vercel Blob store. Credentials come from
 * the environment: OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`) on Vercel,
 * `BLOB_READ_WRITE_TOKEN` from `vercel env pull` locally.
 *
 * @returns The store.
 */
export function createBlobStore(): ArenaStore {
  return {
    async list(prefix) {
      const pathnames: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor });
        pathnames.push(...page.blobs.map((blob) => blob.pathname));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor !== undefined);
      return pathnames;
    },
    async get(pathname) {
      const result = await get(pathname, {
        access: 'private',
        useCache: false,
      });
      if (result?.statusCode !== 200) {
        return null;
      }
      return new Response(result.stream).text();
    },
    async put(pathname, body) {
      await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
    },
    async delete(pathnames) {
      if (pathnames.length > 0) {
        await del(pathnames);
      }
    },
  };
}
