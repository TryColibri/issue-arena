import { type Arena, arenaSchema } from '@/shared/api';

const prefix = 'issue-arena:arena:';

const storageKey = (id: string): string => `${prefix}${id}`;

/**
 * Reads an arena from `localStorage`.
 *
 * @param id - Arena UUID.
 * @returns The arena, or `null` when there is none, storage is blocked or the
 * stored value no longer matches the schema.
 */
export function readLocalArena(id: string): Arena | null {
  try {
    const text = localStorage.getItem(storageKey(id));
    if (text === null) {
      return null;
    }
    const parsed = arenaSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Writes an arena to `localStorage`, synchronously. A blocked or full
 * storage is not an error: the arena then lives in memory and in the cloud.
 *
 * @param arena - The arena to store.
 */
export function writeLocalArena(arena: Arena): void {
  try {
    localStorage.setItem(storageKey(arena.id), JSON.stringify(arena));
  } catch {
    // Storage is blocked or full.
  }
}

/**
 * Removes an arena from `localStorage`.
 *
 * @param id - Arena UUID.
 */
export function removeLocalArena(id: string): void {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // Storage is blocked.
  }
}

/** Which copy of an arena a reconcile kept. */
export type Reconciled = {
  /** The copy with the higher revision. */
  arena: Arena;
  /** Whether it came from the server, so the browser copy must be replaced. */
  fromRemote: boolean;
};

/**
 * Picks the copy with the higher `revision`. On a tie the local copy wins,
 * since there is nothing to copy.
 *
 * @param local - The browser's copy, or `null`.
 * @param remote - The server's copy, or `null`.
 * @returns The winner, or `null` when there is neither.
 */
export function reconcile(
  local: Arena | null,
  remote: Arena | null,
): Reconciled | null {
  if (remote !== null && (local === null || remote.revision > local.revision)) {
    return { arena: remote, fromRemote: true };
  }
  return local === null ? null : { arena: local, fromRemote: false };
}
