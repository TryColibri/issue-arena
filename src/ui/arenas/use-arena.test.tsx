import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Arena } from '@/shared/api';
import { nextBattle } from '@/shared/arena';
import type * as Api from '@/ui/api';
import { client } from '@/ui/api';

import { readLocalArena, writeLocalArena } from './arena-storage';
import { TEST_ARENA_ID, testArena } from './test-arena';
import { FLUSH_DELAY_MS, useArena } from './use-arena';

vi.mock('@/ui/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  return {
    ...actual,
    client: { arenas: { ':id': { $get: vi.fn(), $put: vi.fn() } } },
  };
});

const mockGet = vi.mocked(client.arenas[':id'].$get);
const mockPut = vi.mocked(client.arenas[':id'].$put);

const respond = (status: number, body: unknown = null) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
});

const problem = (status: number) =>
  respond(status, {
    type: 'about:blank',
    title: 'x',
    status,
    detail: 'nope',
  });

// The typed client's responses are structural; tests only need these fields.
const resolve = <T,>(value: T) => value as never;

/** Lets pending promises settle, with fake timers on. */
const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe('useArena', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGet.mockResolvedValue(resolve(problem(404)));
    mockPut.mockResolvedValue(resolve(respond(204)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('opening', () => {
    it('is ready at once from localStorage', () => {
      writeLocalArena(testArena());
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      expect(result.current.status).toBe('ready');
      expect(result.current.arena).toEqual(testArena());
      expect(result.current.battle).not.toBeNull();
    });

    it('loads from the cloud when there is no local copy', async () => {
      mockGet.mockResolvedValue(
        resolve(respond(200, testArena({ revision: 4 }))),
      );
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      expect(result.current.status).toBe('loading');
      await settle();
      expect(result.current.status).toBe('ready');
      expect(result.current.arena?.revision).toBe(4);
      expect(readLocalArena(TEST_ARENA_ID)?.revision).toBe(4);
    });

    it('is missing when neither copy exists', async () => {
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      expect(result.current.status).toBe('missing');
    });

    it('prefers the cloud copy when it has the higher revision', async () => {
      writeLocalArena(testArena({ revision: 1 }));
      mockGet.mockResolvedValue(
        resolve(respond(200, testArena({ revision: 6 }))),
      );
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      expect(result.current.arena?.revision).toBe(6);
      expect(readLocalArena(TEST_ARENA_ID)?.revision).toBe(6);
    });

    it('keeps the local copy when it is newer, and sends it to the cloud', async () => {
      writeLocalArena(testArena({ revision: 8 }));
      mockGet.mockResolvedValue(
        resolve(respond(200, testArena({ revision: 2 }))),
      );
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      expect(result.current.arena?.revision).toBe(8);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
      });
      expect(mockPut).toHaveBeenCalledExactlyOnceWith({
        param: { id: TEST_ARENA_ID },
        json: expect.objectContaining({ revision: 8 }),
      });
    });

    it('keeps playing when the cloud is out of reach', async () => {
      writeLocalArena(testArena());
      mockGet.mockRejectedValue(new TypeError('offline'));
      const { result } = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      expect(result.current.status).toBe('ready');
    });

    it('does not send an arena the cloud already has', async () => {
      writeLocalArena(testArena({ revision: 3 }));
      mockGet.mockResolvedValue(
        resolve(respond(200, testArena({ revision: 3 }))),
      );
      renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS * 2);
      });
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('playing', () => {
    const open = async (arena: Arena = testArena()) => {
      writeLocalArena(arena);
      const hook = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      return hook;
    };

    it('writes every answer to localStorage synchronously', async () => {
      const { result } = await open();
      const battle = nextBattle(testArena());
      act(() => {
        result.current.choose(battle?.a ?? '');
      });
      expect(readLocalArena(TEST_ARENA_ID)?.answers).toHaveLength(1);
      expect(result.current.answered).toBe(1);
      expect(result.current.arena?.revision).toBe(1);
    });

    it('undoes the last answer', async () => {
      const { result } = await open();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      act(() => {
        result.current.undo();
      });
      expect(readLocalArena(TEST_ARENA_ID)?.answers).toEqual([]);
      expect(result.current.answered).toBe(0);
    });

    it('drops an issue', async () => {
      const { result } = await open();
      act(() => {
        result.current.drop('c');
      });
      expect(readLocalArena(TEST_ARENA_ID)?.dropped).toEqual(['c']);
    });

    it('finishes with a ranked top list and no battle', async () => {
      const { result } = await open(
        testArena({ n: 1, candidates: testArena().candidates.slice(0, 2) }),
      );
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      expect(result.current.battle).toBeNull();
      expect(result.current.ranked).toHaveLength(1);
    });
  });

  describe('syncing', () => {
    const play = async () => {
      writeLocalArena(testArena());
      const hook = renderHook(() => useArena(TEST_ARENA_ID));
      await settle();
      return hook;
    };

    it('flushes once, 1.5 s after the last change', async () => {
      const { result } = await play();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      expect(result.current.syncStatus).toBe('pending');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS - 100);
      });
      expect(mockPut).not.toHaveBeenCalled();

      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS - 100);
      });
      expect(mockPut).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mockPut).toHaveBeenCalledExactlyOnceWith({
        param: { id: TEST_ARENA_ID },
        json: expect.objectContaining({ revision: 2 }),
      });
      expect(result.current.syncStatus).toBe('synced');
    });

    it('shows failed after a failed flush, and does not retry on its own', async () => {
      mockPut.mockRejectedValue(new TypeError('offline'));
      const { result } = await play();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
      });
      expect(result.current.syncStatus).toBe('failed');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS * 5);
      });
      expect(mockPut).toHaveBeenCalledOnce();
    });

    it('keeps playing while the cloud is down', async () => {
      mockPut.mockRejectedValue(new TypeError('offline'));
      const { result } = await play();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
      });
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      expect(readLocalArena(TEST_ARENA_ID)?.answers).toHaveLength(2);
    });

    it('treats a 409 as synced', async () => {
      mockPut.mockResolvedValue(resolve(problem(409)));
      const { result } = await play();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
      });
      expect(result.current.syncStatus).toBe('synced');
    });

    it('sends pending changes with keepalive when the page is hidden', async () => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);
      const { result } = await play();
      act(() => {
        result.current.choose(result.current.battle?.a ?? '');
      });
      act(() => {
        window.dispatchEvent(new Event('pagehide'));
      });
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `/api/v1/arenas/${TEST_ARENA_ID}`,
        expect.objectContaining({ method: 'PUT', keepalive: true }),
      );
      vi.unstubAllGlobals();
    });
  });
});
