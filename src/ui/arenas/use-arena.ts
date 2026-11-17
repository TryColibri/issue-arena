import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Arena, arenaSchema } from '@/shared/api';
import {
  answer,
  type Battle,
  drop,
  estimateRemaining,
  replay,
  undo,
} from '@/shared/arena';
import { ApiError, client, unwrap, unwrapEmpty } from '@/ui/api';

import { readLocalArena, reconcile, writeLocalArena } from './arena-storage';

/** Whether the cloud copy is up to date. A quiet indicator, never an error. */
export type SyncStatus = 'synced' | 'pending' | 'failed';

/** What `useArena` returns. */
export type UseArenaResult = {
  /** `loading` until a copy is found; `missing` when there is none anywhere. */
  status: 'loading' | 'ready' | 'missing';
  /** The arena, once `ready`. */
  arena: Arena | null;
  /** The battle to judge, or `null` when the top list is complete. */
  battle: Battle | null;
  /** The top list so far, as issue IDs, best first. */
  ranked: string[];
  /** Battles judged so far. */
  answered: number;
  /** Battles still to go, estimated. */
  remaining: number;
  /** Whether the cloud copy is up to date. */
  syncStatus: SyncStatus;
  /**
   * Records the pick for the current battle.
   *
   * @param winnerID - The issue judged more important.
   */
  choose: (winnerID: string) => void;
  /** Takes back the last answer. */
  undo: () => void;
  /**
   * Removes an issue from the contest.
   *
   * @param issueID - The issue to drop.
   */
  drop: (issueID: string) => void;
};

/** The cloud copy is saved this long after the last change. */
export const FLUSH_DELAY_MS = 1500;

type Loaded = { status: UseArenaResult['status']; arena: Arena | null };

const now = (): string => new Date().toISOString();

/**
 * An arena in play. Every answer, undo or drop is written to `localStorage`
 * at once, so playing is instant and works offline; the cloud copy follows
 * asynchronously, 1.5 s after the last change and when the page is hidden, and
 * failures only show as `syncStatus`. On open the copy with the higher
 * `revision` wins.
 *
 * @param id - Arena UUID.
 */
export function useArena(id: string): UseArenaResult {
  const [loaded, setLoaded] = useState<Loaded>(() => {
    const local = readLocalArena(id);
    return local === null
      ? { status: 'loading', arena: null }
      : { status: 'ready', arena: local };
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const arenaRef = useRef<Arena | null>(loaded.arena);
  const syncedRevision = useRef(-1);
  const sending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const schedule = useCallback((): void => {
    setSyncStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushRef.current();
    }, FLUSH_DELAY_MS);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    const arena = arenaRef.current;
    if (sending.current) {
      return;
    }
    if (arena === null || arena.revision <= syncedRevision.current) {
      setSyncStatus('synced');
      return;
    }
    sending.current = true;
    try {
      await unwrapEmpty(
        client.arenas[':id'].$put({ param: { id }, json: arena }),
      );
      syncedRevision.current = arena.revision;
      setSyncStatus('synced');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The cloud already has this revision or a newer one: nothing to send.
        syncedRevision.current = arena.revision;
        setSyncStatus('synced');
      } else {
        setSyncStatus('failed');
      }
    } finally {
      sending.current = false;
    }
    // Changed while sending: go again. A failure alone does not retry, so a
    // dead server is not hammered; the next change or page hide tries again.
    const latest = arenaRef.current;
    if (latest !== null && latest.revision > arena.revision) {
      schedule();
    }
  }, [id, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // On open: bring in the cloud copy and keep whichever is newer.
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      let remote: Arena | null = null;
      try {
        remote = arenaSchema.parse(
          await unwrap(client.arenas[':id'].$get({ param: { id } })),
        );
      } catch {
        // No cloud copy, or it is out of reach: the browser copy plays on.
      }
      if (cancelled) {
        return;
      }
      const winner = reconcile(readLocalArena(id), remote);
      if (winner === null) {
        setLoaded({ status: 'missing', arena: null });
        return;
      }
      if (winner.fromRemote) {
        writeLocalArena(winner.arena);
        syncedRevision.current = winner.arena.revision;
      } else if (remote !== null) {
        syncedRevision.current = remote.revision;
      }
      arenaRef.current = winner.arena;
      setLoaded({ status: 'ready', arena: winner.arena });
      if (winner.arena.revision > syncedRevision.current) {
        schedule();
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
  }, [id, schedule]);

  // Leaving the page: send what is pending, best effort.
  useEffect(() => {
    const sendNow = () => {
      const arena = arenaRef.current;
      if (arena === null || arena.revision <= syncedRevision.current) {
        return;
      }
      clearTimeout(timer.current);
      fetch(`/api/v1/arenas/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(arena),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', sendNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', sendNow);
      clearTimeout(timer.current);
    };
  }, [id]);

  const apply = useCallback(
    (next: Arena): void => {
      writeLocalArena(next);
      arenaRef.current = next;
      setLoaded({ status: 'ready', arena: next });
      schedule();
    },
    [schedule],
  );

  const choose = useCallback(
    (winnerID: string): void => {
      const arena = arenaRef.current;
      if (arena !== null) {
        apply(answer(arena, winnerID, now()));
      }
    },
    [apply],
  );

  const undoLast = useCallback((): void => {
    const arena = arenaRef.current;
    if (arena !== null) {
      const next = undo(arena, now());
      if (next !== arena) {
        apply(next);
      }
    }
  }, [apply]);

  const dropIssue = useCallback(
    (issueID: string): void => {
      const arena = arenaRef.current;
      if (arena !== null) {
        apply(drop(arena, issueID, now()));
      }
    },
    [apply],
  );

  const derived = useMemo(() => {
    const arena = loaded.arena;
    if (arena === null) {
      return { battle: null, ranked: [], answered: 0, remaining: 0 };
    }
    const state = replay(arena);
    return {
      battle: state.battle,
      ranked: state.top,
      answered: state.consumed.length,
      remaining: estimateRemaining(arena),
    };
  }, [loaded.arena]);

  return {
    status: loaded.status,
    arena: loaded.arena,
    ...derived,
    syncStatus,
    choose,
    undo: undoLast,
    drop: dropIssue,
  };
}
