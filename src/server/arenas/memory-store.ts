import { type ArenaStore } from './store';

/**
 * An in-memory `ArenaStore`, for tests and for running without Blob.
 *
 * @returns A fresh, empty store.
 */
export function createMemoryStore(): ArenaStore {
  const objects = new Map<string, string>();
  return {
    async list(prefix) {
      return [...objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .toSorted();
    },
    async get(pathname) {
      return objects.get(pathname) ?? null;
    },
    async put(pathname, body) {
      objects.set(pathname, body);
    },
    async delete(pathnames) {
      for (const pathname of pathnames) {
        objects.delete(pathname);
      }
    },
  };
}
