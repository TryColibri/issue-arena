/**
 * Where arena documents live: a flat key-value store keyed by pathname.
 * Production uses private Vercel Blob; tests use memory.
 */
export type ArenaStore = {
  /**
   * Lists the pathnames that start with a prefix.
   *
   * @param prefix - Pathname prefix, ending in `/`.
   */
  list(prefix: string): Promise<string[]>;
  /**
   * Reads one object.
   *
   * @param pathname - Where it is stored.
   * @returns Its text, or `null` when there is none.
   */
  get(pathname: string): Promise<string | null>;
  /**
   * Writes one object, replacing any at that pathname.
   *
   * @param pathname - Where to store it.
   * @param body - The text.
   */
  put(pathname: string, body: string): Promise<void>;
  /**
   * Deletes objects. Missing ones are not an error.
   *
   * @param pathnames - What to delete.
   */
  delete(pathnames: string[]): Promise<void>;
};
