import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';
import { type Arena, type ArenaSummary, arenaSchema } from '@/shared/api';
import { replay, validate } from '@/shared/arena';

import { type ArenaStore } from './store';

/** Whose arenas: both IDs always come from the session, never from the client. */
export type ArenaOwner = {
  /** Linear workspace ID. */
  orgID: string;
  /** Linear user ID. */
  userID: string;
};

/** What the API does with arenas. */
export type ArenasService = {
  /**
   * The owner's arenas, most recently updated first.
   *
   * @param owner - Whose arenas.
   */
  list(owner: ArenaOwner): Promise<ArenaSummary[]>;
  /**
   * The latest revision of an arena.
   *
   * @param owner - Whose arena.
   * @param id - Arena UUID.
   * @throws {NotFoundError} When there is none.
   */
  get(owner: ArenaOwner, id: string): Promise<Arena>;
  /**
   * Stores a new revision, then forgets the older ones.
   *
   * @param owner - Whose arena.
   * @param arena - The arena document.
   * @throws {ValidationError} When the document is inconsistent.
   * @throws {ConflictError} When the stored revision is the same or newer.
   */
  save(owner: ArenaOwner, arena: Arena): Promise<void>;
  /**
   * Deletes an arena and all its revisions.
   *
   * @param owner - Whose arena.
   * @param id - Arena UUID.
   */
  delete(owner: ArenaOwner, id: string): Promise<void>;
};

/** Options of `createArenasService`. */
export type ArenasServiceOptions = {
  /** Where documents live. */
  store: ArenaStore;
};

const REVISION_DIGITS = 8;
const MAX_REVISION = 10 ** REVISION_DIGITS - 1;

const ownerPrefix = ({ orgID, userID }: ArenaOwner): string =>
  `arenas/${orgID}/${userID}/`;

const arenaPrefix = (owner: ArenaOwner, id: string): string =>
  `${ownerPrefix(owner)}${id}/`;

const revisionPath = (owner: ArenaOwner, arena: Arena): string =>
  `${arenaPrefix(owner, arena.id)}${String(arena.revision).padStart(REVISION_DIGITS, '0')}.json`;

/** Revision encoded in a pathname, or `null` if it isn't one of ours. */
const revisionOf = (pathname: string): number | null => {
  const match = /\/(\d{8})\.json$/.exec(pathname);
  return match?.[1] === undefined ? null : Number(match[1]);
};

/** The pathname with the highest revision, or `null` when there are none. */
const latestOf = (pathnames: string[]): string | null => {
  let best: { pathname: string; revision: number } | null = null;
  for (const pathname of pathnames) {
    const revision = revisionOf(pathname);
    if (revision !== null && (best === null || revision > best.revision)) {
      best = { pathname, revision };
    }
  }
  return best?.pathname ?? null;
};

/** Parses a stored document. Anything that doesn't match the schema is treated as absent. */
const parseDocument = (text: string | null): Arena | null => {
  if (text === null) {
    return null;
  }
  try {
    const parsed = arenaSchema.safeParse(JSON.parse(text));
    return parsed.success && validate(parsed.data).length === 0
      ? parsed.data
      : null;
  } catch {
    return null;
  }
};

const summarize = (arena: Arena): ArenaSummary => {
  const state = replay(arena);
  return {
    id: arena.id,
    scopeLabel: arena.scopeLabel,
    n: arena.n,
    candidateCount: state.order.length,
    answered: state.consumed.length,
    done: state.battle === null,
    createdAt: arena.createdAt,
    updatedAt: arena.updatedAt,
  };
};

/**
 * Creates the arenas service. Keys are
 * `arenas/<orgID>/<userID>/<arenaID>/<revision, 8 digits>.json`: every save is
 * a new object, so a read never sees a half-overwritten or stale blob, and a
 * save of an older revision is a conflict.
 *
 * @param options - The store.
 */
export function createArenasService({
  store,
}: ArenasServiceOptions): ArenasService {
  const latest = async (
    owner: ArenaOwner,
    id: string,
  ): Promise<Arena | null> => {
    const pathnames = await store.list(arenaPrefix(owner, id));
    const pathname = latestOf(pathnames);
    return pathname === null ? null : parseDocument(await store.get(pathname));
  };

  return {
    async list(owner) {
      const pathnames = await store.list(ownerPrefix(owner));
      const byArena = new Map<string, string[]>();
      for (const pathname of pathnames) {
        const id =
          pathname.slice(ownerPrefix(owner).length).split('/')[0] ?? '';
        byArena.set(id, [...(byArena.get(id) ?? []), pathname]);
      }
      const documents = await Promise.all(
        [...byArena.values()].map(async (paths) => {
          const pathname = latestOf(paths);
          return pathname === null
            ? null
            : parseDocument(await store.get(pathname));
        }),
      );
      return documents
        .filter((arena): arena is Arena => arena !== null)
        .map(summarize)
        .toSorted((x, y) => y.updatedAt.localeCompare(x.updatedAt));
    },
    async get(owner, id) {
      const arena = await latest(owner, id);
      if (arena === null) {
        throw new NotFoundError(`Arena ${id} does not exist.`);
      }
      return arena;
    },
    async save(owner, arena) {
      if (arena.revision > MAX_REVISION) {
        throw new ValidationError([
          { path: 'revision', message: 'The revision is too large.' },
        ]);
      }
      const errors = validate(arena);
      if (errors.length > 0) {
        throw new ValidationError(errors);
      }
      const existing = await store.list(arenaPrefix(owner, arena.id));
      const stored = revisionOf(latestOf(existing) ?? '');
      if (stored !== null && arena.revision <= stored) {
        throw new ConflictError(
          `Arena ${arena.id} is already at revision ${stored}.`,
        );
      }
      const pathname = revisionPath(owner, arena);
      await store.put(pathname, JSON.stringify(arenaSchema.parse(arena)));
      try {
        await store.delete(existing.filter((path) => path !== pathname));
      } catch {
        // Old revisions are garbage: the next save tries again.
      }
    },
    async delete(owner, id) {
      await store.delete(await store.list(arenaPrefix(owner, id)));
    },
  };
}
