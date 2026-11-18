import { describe, expect, it } from 'vitest';

import { type Arena, type Issue } from '@/shared/api';

import {
  answer,
  drop,
  estimateBattles,
  nextBattle,
  rankedIDs,
  replay,
  undo,
  validate,
} from './engine';

const NOW = '2026-01-01T00:00:00.000Z';

const issue = (id: string, priority = 0, sortOrder = 0): Issue => ({
  id,
  identifier: `T-${id}`,
  title: `Issue ${id}`,
  url: `https://linear.app/t/issue/T-${id}`,
  priority,
  priorityLabel: 'None',
  sortOrder,
  state: { name: 'Backlog', type: 'backlog' },
  teamKey: 'T',
  blocked: false,
  assignee: null,
  projectName: null,
  labels: [],
  estimate: null,
  dueDate: null,
  excerpt: '',
});

const arena = (candidates: Issue[], n: number): Arena => ({
  id: '00000000-0000-4000-8000-000000000000',
  scopeLabel: 'All issues',
  scope: { type: 'all' },
  n,
  candidates,
  answers: [],
  dropped: [],
  revision: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

/** A small deterministic PRNG, so failures reproduce. */
const rng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const shuffled = <T>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

type PlayResult = { state: Arena; battles: number };

/** Plays an arena to the end, answering from a hidden total order. */
const play = (start: Arena, rank: Map<string, number>): PlayResult => {
  let state = start;
  let battles = 0;
  for (let battle = nextBattle(state); battle !== null;) {
    const aWins = (rank.get(battle.a) ?? 0) < (rank.get(battle.b) ?? 0);
    state = answer(state, aWins ? battle.a : battle.b, NOW);
    battles += 1;
    battle = nextBattle(state);
  }
  return { state, battles };
};

describe('engine', () => {
  describe('replay', () => {
    it('orders candidates by priority, urgent first and none last', () => {
      const state = arena(
        [issue('none', 0), issue('low', 4), issue('urgent', 1)],
        3,
      );
      expect(replay(state).order).toEqual(['urgent', 'low', 'none']);
    });

    it('breaks priority ties by sort order', () => {
      const state = arena([issue('b', 2, 5), issue('a', 2, -3)], 2);
      expect(replay(state).order).toEqual(['a', 'b']);
    });

    it('is done at once for a single candidate', () => {
      const state = arena([issue('only')], 1);
      expect(nextBattle(state)).toBeNull();
      expect(rankedIDs(state)).toEqual(['only']);
    });

    it('is done at once with no candidates', () => {
      const state = arena([], 3);
      expect(nextBattle(state)).toBeNull();
      expect(rankedIDs(state)).toEqual([]);
    });

    it('asks the candidate against the weakest of a full list first', () => {
      let state = arena([issue('1', 1), issue('2', 1), issue('3', 2)], 2);
      const first = nextBattle(state);
      expect(first).not.toBeNull();
      state = answer(state, first?.a ?? '', NOW);
      expect(rankedIDs(state)).toEqual(expect.any(Array));
      // The third candidate meets the current #2 directly.
      const second = nextBattle(state);
      expect(second?.a).toBe('3');
      expect(second?.b).toBe(rankedIDs(state).at(-1));
    });
  });

  describe('answer', () => {
    it('increments the revision and sets the timestamp', () => {
      const state = arena([issue('1'), issue('2')], 2);
      const battle = nextBattle(state);
      const next = answer(state, battle?.a ?? '', '2026-02-02T00:00:00.000Z');
      expect(next.revision).toBe(1);
      expect(next.updatedAt).toBe('2026-02-02T00:00:00.000Z');
      expect(next.answers).toEqual([
        { a: battle?.a, b: battle?.b, winner: battle?.a },
      ]);
    });

    it('does not mutate the arena it is given', () => {
      const state = arena([issue('1'), issue('2')], 1);
      const battle = nextBattle(state);
      answer(state, battle?.a ?? '', NOW);
      expect(state.answers).toEqual([]);
    });

    it('rejects a winner that is not in the battle', () => {
      const state = arena([issue('1'), issue('2')], 2);
      expect(() => answer(state, 'nope', NOW)).toThrow(
        'not in the pending battle',
      );
    });

    it('rejects an answer when no battle is pending', () => {
      const state = arena([issue('1')], 1);
      expect(() => answer(state, '1', NOW)).toThrow('no pending battle');
    });
  });

  describe('property: ranking', () => {
    const sizes = [1, 5, 37, 150];
    const tops = [1, 3, 10];

    for (const m of sizes) {
      for (const n of tops) {
        it(`finds the exact top ${n} of ${m} in order`, () => {
          for (let seed = 1; seed <= 12; seed += 1) {
            const random = rng(seed * 7919 + m * 31 + n);
            const truth = shuffled(
              Array.from({ length: m }, (_, i) => String(i)),
              random,
            );
            const rank = new Map(truth.map((id, index) => [id, index]));
            // Priorities are noise: the engine must not depend on them.
            const candidates = truth.map((id) =>
              issue(id, Math.floor(random() * 5), random()),
            );
            const { state, battles } = play(arena(candidates, n), rank);

            expect(rankedIDs(state)).toEqual(truth.slice(0, Math.min(n, m)));
            const bound = m + m * Math.ceil(Math.log2(n));
            expect(battles).toBeLessThanOrEqual(bound);
          }
        });
      }
    }

    it('needs few battles when candidates arrive strongest first', () => {
      const m = 150;
      const n = 10;
      const candidates = Array.from({ length: m }, (_, i) =>
        issue(String(i), 1, i),
      );
      const rank = new Map(candidates.map((c, i) => [c.id, i]));
      const { state, battles } = play(arena(candidates, n), rank);
      expect(rankedIDs(state)).toEqual(candidates.slice(0, n).map((c) => c.id));
      expect(battles).toBeLessThan(m + 40);
    });
  });

  describe('undo', () => {
    it('reverts the last answer and its effect', () => {
      let state = arena([issue('1'), issue('2'), issue('3')], 2);
      const before = nextBattle(state);
      state = answer(state, before?.a ?? '', NOW);
      const undone = undo(state, NOW);
      expect(undone.answers).toEqual([]);
      expect(nextBattle(undone)).toEqual(before);
      expect(undone.revision).toBe(2);
    });

    it('is a no-op when nothing was answered', () => {
      const state = arena([issue('1'), issue('2')], 1);
      expect(undo(state, NOW)).toBe(state);
    });

    it('undoing every answer returns to the start, replay is idempotent', () => {
      const random = rng(42);
      const truth = shuffled(
        Array.from({ length: 20 }, (_, i) => String(i)),
        random,
      );
      const rank = new Map(truth.map((id, index) => [id, index]));
      const start = arena(
        truth.map((id) => issue(id)),
        3,
      );
      let state = play(start, rank).state;
      const finalTop = rankedIDs(state);
      expect(replay(state)).toEqual(replay(state));
      while (state.answers.length > 0) {
        state = undo(state, NOW);
      }
      expect(nextBattle(state)).toEqual(nextBattle(start));
      expect(rankedIDs(play(state, rank).state)).toEqual(finalTop);
    });
  });

  describe('drop', () => {
    it('removes the candidate and the answers that involve it', () => {
      let state = arena([issue('1'), issue('2'), issue('3')], 3);
      const battle = nextBattle(state);
      state = answer(state, battle?.a ?? '', NOW);
      const dropped = drop(state, battle?.b ?? '', NOW);
      expect(dropped.dropped).toEqual([battle?.b]);
      expect(dropped.answers).toEqual([]);
      expect(replay(dropped).order).not.toContain(battle?.b);
    });

    it('works mid-insertion and still ranks the rest correctly', () => {
      const random = rng(99);
      const truth = shuffled(
        Array.from({ length: 30 }, (_, i) => String(i)),
        random,
      );
      const rank = new Map(truth.map((id, index) => [id, index]));
      let state = arena(
        truth.map((id) => issue(id)),
        5,
      );
      // Answer a few battles, then drop the candidate being inserted.
      for (let step = 0; step < 12; step += 1) {
        const battle = nextBattle(state);
        const aWins =
          (rank.get(battle?.a ?? '') ?? 0) < (rank.get(battle?.b ?? '') ?? 0);
        state = answer(
          state,
          aWins ? (battle?.a ?? '') : (battle?.b ?? ''),
          NOW,
        );
      }
      const pending = nextBattle(state);
      const droppedIDs = [pending?.a ?? '', truth[0] ?? ''];
      for (const id of droppedIDs) {
        state = drop(state, id, NOW);
      }
      const { state: finished } = play(state, rank);
      const expected = truth
        .filter((id) => !droppedIDs.includes(id))
        .slice(0, 5);
      expect(rankedIDs(finished)).toEqual(expected);
    });

    it('rejects an unknown or already dropped candidate', () => {
      const state = arena([issue('1'), issue('2')], 1);
      expect(() => drop(state, 'nope', NOW)).toThrow('not competing');
      expect(() => drop(drop(state, '1', NOW), '1', NOW)).toThrow(
        'not competing',
      );
    });
  });

  describe('estimateBattles', () => {
    it('is zero for one candidate', () => {
      expect(estimateBattles({ count: 1, n: 1 })).toBe(0);
    });

    it('stays within the worst-case bound', () => {
      for (const count of [5, 37, 150]) {
        for (const n of [1, 3, 10]) {
          const estimate = estimateBattles({ count, n });
          expect(estimate).toBeGreaterThanOrEqual(count - 1);
          expect(estimate).toBeLessThanOrEqual(
            count + count * Math.ceil(Math.log2(n)),
          );
        }
      }
    });
  });

  describe('validate', () => {
    it('accepts a played arena', () => {
      const state = arena([issue('1'), issue('2'), issue('3')], 2);
      const battle = nextBattle(state);
      expect(validate(answer(state, battle?.a ?? '', NOW))).toEqual([]);
    });

    it('reports duplicate candidate IDs', () => {
      expect(validate(arena([issue('1'), issue('1')], 1))).toContainEqual(
        expect.objectContaining({ path: 'candidates.1.id' }),
      );
    });

    it('reports n larger than the number of candidates', () => {
      expect(validate(arena([issue('1')], 2))).toContainEqual(
        expect.objectContaining({ path: 'n' }),
      );
    });

    it('reports answers about unknown issues and winners outside the pair', () => {
      const state: Arena = {
        ...arena([issue('1'), issue('2')], 1),
        answers: [
          { a: '1', b: 'ghost', winner: '1' },
          { a: '1', b: '2', winner: '3' },
        ],
      };
      const paths = validate(state).map((error) => error.path);
      expect(paths).toContain('answers.0.b');
      expect(paths).toContain('answers.1.winner');
    });

    it('reports repeated pairs and unknown dropped IDs', () => {
      const state: Arena = {
        ...arena([issue('1'), issue('2')], 1),
        answers: [
          { a: '1', b: '2', winner: '1' },
          { a: '2', b: '1', winner: '2' },
        ],
        dropped: ['ghost'],
      };
      const paths = validate(state).map((error) => error.path);
      expect(paths).toContain('answers.1');
      expect(paths).toContain('dropped.0');
    });
  });
});
