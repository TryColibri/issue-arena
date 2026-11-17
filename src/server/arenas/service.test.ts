import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';
import { type Arena, type Issue } from '@/shared/api';
import { answer, nextBattle } from '@/shared/arena';

import { createMemoryStore } from './memory-store';
import {
  type ArenaOwner,
  type ArenasService,
  createArenasService,
} from './service';
import { type ArenaStore } from './store';

const OWNER: ArenaOwner = { orgID: 'org-1', userID: 'user-1' };
const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-01-01T00:00:00.000Z';

const issue = (id: string): Issue => ({
  id,
  identifier: `T-${id}`,
  title: id,
  url: `https://linear.app/t/issue/T-${id}`,
  priority: 0,
  priorityLabel: 'None',
  sortOrder: 0,
  state: { name: 'Todo', type: 'unstarted' },
  teamKey: 'T',
  assignee: null,
  projectName: null,
  labels: [],
  estimate: null,
  dueDate: null,
  excerpt: '',
});

const arena = (overrides: Partial<Arena> = {}): Arena => ({
  id: ID,
  scopeLabel: 'All issues',
  scope: { type: 'all' },
  n: 2,
  candidates: [issue('a'), issue('b'), issue('c')],
  answers: [],
  dropped: [],
  revision: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

describe('ArenasService', () => {
  let store: ArenaStore;
  let service: ArenasService;

  beforeEach(() => {
    store = createMemoryStore();
    service = createArenasService({ store });
  });

  describe('save and get', () => {
    it('round-trips an arena', async () => {
      await service.save(OWNER, arena());
      expect(await service.get(OWNER, ID)).toEqual(arena());
    });

    it('stores each revision under a padded key', async () => {
      await service.save(OWNER, arena({ revision: 12 }));
      expect(await store.list('arenas/')).toEqual([
        `arenas/org-1/user-1/${ID}/00000012.json`,
      ]);
    });

    it('returns the latest revision and forgets older ones', async () => {
      await service.save(OWNER, arena({ revision: 1 }));
      const played = answer(arena(), nextBattle(arena())?.a ?? '', NOW);
      await service.save(OWNER, { ...played, revision: 2 });
      expect((await service.get(OWNER, ID)).revision).toBe(2);
      expect(await store.list('arenas/')).toHaveLength(1);
    });

    it('rejects the same or an older revision as a conflict', async () => {
      await service.save(OWNER, arena({ revision: 5 }));
      await expect(service.save(OWNER, arena({ revision: 5 }))).rejects.toThrow(
        ConflictError,
      );
      await expect(service.save(OWNER, arena({ revision: 3 }))).rejects.toThrow(
        ConflictError,
      );
    });

    it('rejects an inconsistent document', async () => {
      const bad = arena({ answers: [{ a: 'a', b: 'ghost', winner: 'a' }] });
      await expect(service.save(OWNER, bad)).rejects.toThrow(ValidationError);
    });

    it('rejects a revision that does not fit the key', async () => {
      await expect(
        service.save(OWNER, arena({ revision: 100_000_000 })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError for an unknown arena', async () => {
      await expect(service.get(OWNER, ID)).rejects.toThrow(NotFoundError);
    });

    it('keeps owners apart', async () => {
      await service.save(OWNER, arena());
      const other: ArenaOwner = { orgID: 'org-1', userID: 'user-2' };
      await expect(service.get(other, ID)).rejects.toThrow(NotFoundError);
      expect(await service.list(other)).toEqual([]);
    });

    it('ignores stored documents that no longer match the schema', async () => {
      await store.put(`arenas/org-1/user-1/${ID}/00000001.json`, '{"nope":1}');
      await expect(service.get(OWNER, ID)).rejects.toThrow(NotFoundError);
      expect(await service.list(OWNER)).toEqual([]);
    });
  });

  describe('list', () => {
    it('summarizes arenas, most recently updated first', async () => {
      const other = '22222222-2222-4222-8222-222222222222';
      await service.save(
        OWNER,
        arena({ updatedAt: '2026-01-01T00:00:00.000Z' }),
      );
      await service.save(
        OWNER,
        arena({
          id: other,
          scopeLabel: 'Backlog',
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
      );
      const items = await service.list(OWNER);
      expect(items.map((item) => item.id)).toEqual([other, ID]);
      expect(items[0]).toMatchObject({
        scopeLabel: 'Backlog',
        n: 2,
        candidateCount: 3,
        answered: 0,
        done: false,
      });
    });

    it('reports progress and completion', async () => {
      let state = arena({ n: 1, candidates: [issue('a'), issue('b')] });
      state = answer(state, nextBattle(state)?.a ?? '', NOW);
      await service.save(OWNER, state);
      expect(await service.list(OWNER)).toEqual([
        expect.objectContaining({ answered: 1, done: true }),
      ]);
    });
  });

  describe('delete', () => {
    it('removes every revision', async () => {
      await service.save(OWNER, arena());
      await service.delete(OWNER, ID);
      expect(await store.list('arenas/')).toEqual([]);
    });

    it('does not fail for an unknown arena', async () => {
      await expect(service.delete(OWNER, ID)).resolves.toBeUndefined();
    });
  });
});
