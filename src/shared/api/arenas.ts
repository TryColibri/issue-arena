import { z } from 'zod';

import { type Issue, issueSchema, MAX_ARENA_ISSUES } from './issues';
import { type Scope, scopeSchema } from './scope';

/** One judged battle: the user picked `winner` between `a` and `b`. */
export type Answer = {
  /** ID of the candidate whose turn it was. */
  a: string;
  /** ID of the issue it was compared with. */
  b: string;
  /** ID of the issue the user judged more important: `a` or `b`. */
  winner: string;
};

export const answerSchema: z.ZodType<Answer> = z.strictObject({
  a: z.string().describe('ID of the candidate whose turn it was.'),
  b: z.string().describe('ID of the issue it was compared with.'),
  winner: z
    .string()
    .describe('ID of the issue the user judged more important: `a` or `b`.'),
});

/**
 * A ranking arena, the whole persisted document. Everything else (the top
 * list, the next battle) is derived from it by replaying the answers.
 */
export type Arena = {
  /** UUID chosen by the client. */
  id: string;
  /** What the scope looked like to the user, e.g. `Project: Billing`. */
  scopeLabel: string;
  /** The scope the candidates were fetched with, so "Run again" works. */
  scope: Scope;
  /** How many issues to rank, at least 1. */
  n: number;
  /** The issues to rank, at most `MAX_ARENA_ISSUES`. */
  candidates: Issue[];
  /** Every judged battle, oldest first. */
  answers: Answer[];
  /** IDs of candidates the user removed from the contest. */
  dropped: string[];
  /** Increases by one on every change: the larger one wins a reconcile. */
  revision: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
};

export const arenaSchema: z.ZodType<Arena> = z.strictObject({
  id: z.uuid().describe('UUID chosen by the client.'),
  scopeLabel: z
    .string()
    .max(200)
    .describe(
      'What the scope looked like to the user, e.g. `Project: Billing`.',
    ),
  scope: scopeSchema.describe(
    'The scope the candidates were fetched with, so "Run again" works.',
  ),
  n: z.number().int().min(1).describe('How many issues to rank, at least 1.'),
  candidates: z
    .array(issueSchema)
    .max(MAX_ARENA_ISSUES)
    .describe('The issues to rank, at most `MAX_ARENA_ISSUES`.'),
  answers: z.array(answerSchema).describe('Every judged battle, oldest first.'),
  dropped: z
    .array(z.string())
    .describe('IDs of candidates the user removed from the contest.'),
  revision: z
    .number()
    .int()
    .min(0)
    .describe(
      'Increases by one on every change: the larger one wins a reconcile.',
    ),
  createdAt: z.iso.datetime().describe('ISO timestamp of creation.'),
  updatedAt: z.iso.datetime().describe('ISO timestamp of the last change.'),
});

/** An arena as listed on the home page. */
export type ArenaSummary = {
  /** Arena UUID. */
  id: string;
  /** What the scope looked like to the user. */
  scopeLabel: string;
  /** How many issues are ranked. */
  n: number;
  /** How many issues compete (candidates minus dropped). */
  candidateCount: number;
  /** How many battles were judged. */
  answered: number;
  /** Whether the top list is complete. */
  done: boolean;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
};

export const arenaSummarySchema: z.ZodType<ArenaSummary> = z.strictObject({
  id: z.uuid().describe('Arena UUID.'),
  scopeLabel: z.string().describe('What the scope looked like to the user.'),
  n: z.number().int().describe('How many issues are ranked.'),
  candidateCount: z
    .number()
    .int()
    .describe('How many issues compete (candidates minus dropped).'),
  answered: z.number().int().describe('How many battles were judged.'),
  done: z.boolean().describe('Whether the top list is complete.'),
  createdAt: z.iso.datetime().describe('ISO timestamp of creation.'),
  updatedAt: z.iso.datetime().describe('ISO timestamp of the last change.'),
});

/** Response of `GET /api/v1/arenas`. */
export type ArenaList = {
  /** The signed-in user's arenas, most recently updated first. */
  items: ArenaSummary[];
};

export const arenaListSchema: z.ZodType<ArenaList> = z.strictObject({
  items: z
    .array(arenaSummarySchema)
    .describe("The signed-in user's arenas, most recently updated first."),
});
