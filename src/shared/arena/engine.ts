import {
  type Answer,
  type Arena,
  type FieldError,
  type Issue,
} from '@/shared/api';

/** The next question for the user: which of two issues is more important. */
export type Battle = {
  /** ID of the candidate whose turn it is. */
  a: string;
  /** ID of the issue it is compared with. */
  b: string;
};

/** What replaying an arena's answers produces. */
export type Replay = {
  /** IDs of the competing candidates, in the order they are processed. */
  order: string[];
  /** The top list so far, best first. At most `n` long. */
  top: string[];
  /** The next battle to judge, or `null` when the top list is complete. */
  battle: Battle | null;
  /** Indexes of the answers the replay used, in the order it used them. */
  consumed: number[];
  /** How many candidates are still to be placed, the one in play included. */
  remaining: number;
};

const pairKey = (x: string, y: string): string =>
  x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`;

/**
 * Candidates in the order they are processed: priority (urgent to low, then
 * no priority), then Linear's `sortOrder` (lower first, as Linear lists them),
 * then ID. Strong issues come first, so the top list fills with good items
 * early and weaker ones are rejected in a single battle.
 */
const compareCandidates = (x: Issue, y: Issue): number => {
  const rankOf = (priority: number) => (priority === 0 ? 5 : priority);
  const byPriority = rankOf(x.priority) - rankOf(y.priority);
  if (byPriority !== 0) {
    return byPriority;
  }
  const bySortOrder = x.sortOrder - y.sortOrder;
  if (bySortOrder !== 0) {
    return bySortOrder;
  }
  if (x.id === y.id) {
    return 0;
  }
  return x.id < y.id ? -1 : 1;
};

/**
 * Issues in the order the engine processes them: priority (urgent to low, then
 * no priority), then Linear's `sortOrder`, then ID. Cutting this list short
 * keeps the highest-priority issues.
 *
 * @param issues - Issues to order.
 * @returns A new array.
 */
export function orderCandidates(issues: Issue[]): Issue[] {
  return issues.toSorted(compareCandidates);
}

/**
 * Rebuilds the arena's state from its answers, deterministically.
 *
 * The algorithm is threshold-first binary insertion. While the top list has
 * fewer than `n` items, each candidate is binary-inserted into it. Once it is
 * full, a candidate first meets the current last place: a loser is discarded,
 * a winner is binary-inserted into the other ranks and the old last place
 * drops out.
 *
 * Answers are a set of pairwise judgments. Whenever the algorithm needs to
 * compare two issues it reuses the judgment if there is one, and otherwise
 * stops: that comparison is the next battle. Answers about dropped issues are
 * never consulted, so dropping or undoing is just replaying.
 *
 * @param arena - The arena to replay.
 */
export function replay(arena: Arena): Replay {
  const dropped = new Set(arena.dropped);
  const order = orderCandidates(
    arena.candidates.filter((candidate) => !dropped.has(candidate.id)),
  ).map((candidate) => candidate.id);

  const judgments = new Map<string, { winner: string; index: number }>();
  arena.answers.forEach((entry, index) => {
    judgments.set(pairKey(entry.a, entry.b), { winner: entry.winner, index });
  });

  const n = Math.max(1, arena.n);
  const top: string[] = [];
  const consumed: number[] = [];

  /** Whether `candidate` beats `incumbent`, or `null` if nobody judged them yet. */
  const judge = (candidate: string, incumbent: string): boolean | null => {
    const judgment = judgments.get(pairKey(candidate, incumbent));
    if (judgment === undefined) {
      return null;
    }
    consumed.push(judgment.index);
    return judgment.winner === candidate;
  };

  const pendingAt = (index: number, battle: Battle): Replay => ({
    order,
    top,
    battle,
    consumed,
    remaining: order.length - index,
  });

  for (const [index, candidate] of order.entries()) {
    if (top.length === 0) {
      top.push(candidate);
      continue;
    }

    let low = 0;
    let high = top.length;
    if (top.length >= n) {
      const threshold = top[n - 1] ?? '';
      const beats = judge(candidate, threshold);
      if (beats === null) {
        return pendingAt(index, { a: candidate, b: threshold });
      }
      if (!beats) {
        continue;
      }
      high = n - 1;
    }

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const incumbent = top[middle] ?? '';
      const beats = judge(candidate, incumbent);
      if (beats === null) {
        return pendingAt(index, { a: candidate, b: incumbent });
      }
      if (beats) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }

    top.splice(low, 0, candidate);
    if (top.length > n) {
      top.pop();
    }
  }

  return { order, top, battle: null, consumed, remaining: 0 };
}

/**
 * The next battle to judge.
 *
 * @param arena - The arena.
 * @returns The battle, or `null` when the top list is complete.
 */
export function nextBattle(arena: Arena): Battle | null {
  return replay(arena).battle;
}

/**
 * The current top list, best first. Complete once `nextBattle` is `null`.
 *
 * @param arena - The arena.
 */
export function rankedIDs(arena: Arena): string[] {
  return replay(arena).top;
}

/**
 * Records the user's pick for the pending battle. Pure: returns a new arena.
 *
 * @param arena - The arena.
 * @param winnerID - ID of the issue judged more important, `a` or `b` of the pending battle.
 * @param at - ISO timestamp of the change.
 * @throws {Error} When no battle is pending or `winnerID` is not in it.
 */
export function answer(arena: Arena, winnerID: string, at: string): Arena {
  const battle = nextBattle(arena);
  if (battle === null) {
    throw new Error('There is no pending battle to answer.');
  }
  if (winnerID !== battle.a && winnerID !== battle.b) {
    throw new Error(`Issue ${winnerID} is not in the pending battle.`);
  }
  const entry: Answer = { a: battle.a, b: battle.b, winner: winnerID };
  return {
    ...arena,
    answers: [...arena.answers, entry],
    revision: arena.revision + 1,
    updatedAt: at,
  };
}

/**
 * Takes back the last answer that still matters. Answers made obsolete by a
 * drop are left alone, so undoing never looks like a no-op.
 *
 * @param arena - The arena.
 * @param at - ISO timestamp of the change.
 * @returns A new arena, or `arena` itself when there is nothing to undo.
 */
export function undo(arena: Arena, at: string): Arena {
  const { consumed } = replay(arena);
  if (consumed.length === 0) {
    return arena;
  }
  const last = Math.max(...consumed);
  return {
    ...arena,
    answers: arena.answers.filter((_, index) => index !== last),
    revision: arena.revision + 1,
    updatedAt: at,
  };
}

/**
 * Removes a candidate from the contest, for example because it is stale, and
 * forgets the answers that involve it.
 *
 * @param arena - The arena.
 * @param id - ID of the candidate to drop.
 * @param at - ISO timestamp of the change.
 * @throws {Error} When `id` is not a competing candidate.
 */
export function drop(arena: Arena, id: string, at: string): Arena {
  const competing = arena.candidates.some((candidate) => candidate.id === id);
  if (!competing || arena.dropped.includes(id)) {
    throw new Error(`Issue ${id} is not competing.`);
  }
  return {
    ...arena,
    dropped: [...arena.dropped, id],
    answers: arena.answers.filter((entry) => entry.a !== id && entry.b !== id),
    revision: arena.revision + 1,
    updatedAt: at,
  };
}

/** Inputs of `estimateBattles`. */
export type EstimateParams = {
  /** How many candidates are still to be placed. */
  count: number;
  /** How many issues the top list holds. */
  n: number;
  /** How many candidates are already in the top list. Default: 0. */
  placed?: number;
  /** How many candidates were already processed, in or out. Default: `placed`. */
  processed?: number;
};

const log2 = (value: number): number => (value <= 1 ? 0 : Math.log2(value));

/**
 * Estimates how many battles are needed to place `count` more candidates.
 *
 * Filling the list costs about log₂ of its size per candidate. After that each
 * candidate costs one threshold battle, plus about log₂N more when it wins:
 * for a random order the expected number of winners is Σ N/i.
 *
 * @param params - Candidates left, list size and progress.
 * @returns A whole number of battles. Always at most `count · (1 + ⌈log₂N⌉)`.
 */
export function estimateBattles({
  count,
  n,
  placed = 0,
  processed = placed,
}: EstimateParams): number {
  const size = Math.max(1, n);
  let battles = 0;
  let listSize = placed;
  let seen = processed;
  for (let step = 0; step < count; step += 1) {
    if (listSize < size) {
      battles += Math.ceil(log2(listSize + 1));
      listSize += 1;
    } else {
      const winChance = Math.min(1, size / (seen + 1));
      battles += 1 + winChance * log2(size);
    }
    seen += 1;
  }
  return Math.round(battles);
}

/**
 * Battles still to go, estimated from where the replay stands.
 *
 * @param arena - The arena.
 */
export function estimateRemaining(arena: Arena): number {
  const state = replay(arena);
  if (state.battle === null) {
    return 0;
  }
  return Math.max(
    1,
    estimateBattles({
      count: state.remaining,
      n: arena.n,
      placed: state.top.length,
      processed: state.order.length - state.remaining,
    }),
  );
}

/**
 * Checks an arena for internal consistency: unique candidate IDs, `n` within
 * the candidate count, answers that name known issues and a winner from their
 * pair, no pair judged twice, dropped IDs that exist.
 *
 * @param arena - The arena, already shaped like the schema.
 * @returns One entry per problem, empty when the arena is consistent.
 */
export function validate(arena: Arena): FieldError[] {
  const errors: FieldError[] = [];
  const known = new Set<string>();
  arena.candidates.forEach((candidate, index) => {
    if (known.has(candidate.id)) {
      errors.push({
        path: `candidates.${index}.id`,
        message: `Duplicate candidate ${candidate.id}.`,
      });
    }
    known.add(candidate.id);
  });

  if (arena.n > Math.max(1, arena.candidates.length)) {
    errors.push({
      path: 'n',
      message: 'n is larger than the number of candidates.',
    });
  }

  const seen = new Set<string>();
  arena.answers.forEach((entry, index) => {
    for (const side of ['a', 'b'] as const) {
      if (!known.has(entry[side])) {
        errors.push({
          path: `answers.${index}.${side}`,
          message: `Unknown issue ${entry[side]}.`,
        });
      }
    }
    if (entry.winner !== entry.a && entry.winner !== entry.b) {
      errors.push({
        path: `answers.${index}.winner`,
        message: 'The winner must be one of the two issues.',
      });
    }
    const key = pairKey(entry.a, entry.b);
    if (seen.has(key)) {
      errors.push({
        path: `answers.${index}`,
        message: 'This pair was already judged.',
      });
    }
    seen.add(key);
  });

  arena.dropped.forEach((id, index) => {
    if (!known.has(id)) {
      errors.push({
        path: `dropped.${index}`,
        message: `Unknown issue ${id}.`,
      });
    }
  });
  return errors;
}
