import { z } from 'zod';

/** Most conditions one filter may hold. */
export const MAX_FILTER_CONDITIONS = 20;

/** Whether a condition's value list must contain the field (`is`) or not (`isNot`). */
export type SetOperator = 'is' | 'isNot';

/** Comparison of a number against a value. */
export type NumberOperator = 'lt' | 'gt' | 'eq';

/** A date bound: before or after an ISO date or a relative ISO 8601 duration. */
export type DateOperator = 'before' | 'after';

/** The built-in assignee value for the signed-in user. */
export const ASSIGNEE_ME = 'me';
/** The assignee value for issues nobody is assigned to. */
export const ASSIGNEE_NONE = 'none';
/** The cycle value for the team's current cycle. */
export const CYCLE_CURRENT = 'current';

/**
 * One filter condition, a union on `field`. Fields that match a list of
 * Linear IDs take an `is` or `isNot` operator and the IDs.
 */
export type Condition =
  | {
      field: 'team' | 'creator' | 'label' | 'project' | 'initiative';
      /** Whether the issue's value is in `ids` (`is`) or not (`isNot`). */
      operator: SetOperator;
      /** Linear IDs. */
      ids: string[];
    }
  | {
      field: 'status';
      /** Whether the issue's state is in `ids` (`is`) or not (`isNot`). */
      operator: SetOperator;
      /** Workflow state IDs, or state types (`backlog`, `unstarted`, …). */
      ids: string[];
    }
  | {
      field: 'assignee';
      /** Whether the assignee is in `ids` (`is`) or not (`isNot`). */
      operator: SetOperator;
      /** User IDs, `me` or `none`. */
      ids: string[];
    }
  | {
      field: 'cycle';
      /** Whether the issue's cycle is in `ids` (`is`) or not (`isNot`). */
      operator: SetOperator;
      /** Cycle IDs or `current`. */
      ids: string[];
    }
  | {
      field: 'priority';
      /** Whether the priority is in `values` (`is`) or not (`isNot`). */
      operator: SetOperator;
      /** Linear priorities: 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
      values: number[];
    }
  | {
      field: 'estimate';
      /** How to compare, or `none` for issues without an estimate. */
      operator: NumberOperator | 'none';
      /** The estimate to compare against. Ignored for `none`. */
      value?: number;
    }
  | {
      field: 'dueDate' | 'createdAt' | 'updatedAt';
      /** Before or after `value`. */
      operator: DateOperator;
      /** An ISO date (`2026-01-31`) or a relative duration (`-P2W`). */
      value: string;
    }
  | {
      field: 'title';
      /** Case-insensitive substring match. */
      operator: 'contains';
      /** The text to look for. */
      value: string;
    };

/** A custom issue filter: conditions combined with `all` (and) or `any` (or). */
export type IssueFilter = {
  /** Whether every condition (`all`) or at least one (`any`) must match. */
  match: 'all' | 'any';
  /** The conditions, at most `MAX_FILTER_CONDITIONS`. */
  conditions: Condition[];
};

const setOperator = z.enum(['is', 'isNot']);
const ids = z.array(z.string().min(1)).min(1).max(50);

const dateValue = z
  .string()
  .regex(
    /^(\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?|-?P(\d+[YMWD])+)$/,
    'Expected an ISO date or a relative ISO 8601 duration such as -P2W.',
  );

export const conditionSchema: z.ZodType<Condition> = z.discriminatedUnion(
  'field',
  [
    z.strictObject({
      field: z.enum(['team', 'creator', 'label', 'project', 'initiative']),
      operator: setOperator,
      ids,
    }),
    z.strictObject({ field: z.literal('status'), operator: setOperator, ids }),
    z.strictObject({
      field: z.literal('assignee'),
      operator: setOperator,
      ids,
    }),
    z.strictObject({ field: z.literal('cycle'), operator: setOperator, ids }),
    z.strictObject({
      field: z.literal('priority'),
      operator: setOperator,
      values: z.array(z.number().int().min(0).max(4)).min(1).max(5),
    }),
    z.strictObject({
      field: z.literal('estimate'),
      operator: z.enum(['lt', 'gt', 'eq', 'none']),
      value: z.number().optional(),
    }),
    z.strictObject({
      field: z.enum(['dueDate', 'createdAt', 'updatedAt']),
      operator: z.enum(['before', 'after']),
      value: dateValue,
    }),
    z.strictObject({
      field: z.literal('title'),
      operator: z.literal('contains'),
      value: z.string().min(1).max(200),
    }),
  ],
);

export const issueFilterSchema: z.ZodType<IssueFilter> = z.strictObject({
  match: z
    .enum(['all', 'any'])
    .describe(
      'Whether every condition (`all`) or at least one (`any`) must match.',
    ),
  conditions: z
    .array(conditionSchema)
    .max(MAX_FILTER_CONDITIONS)
    .describe('The conditions, at most `MAX_FILTER_CONDITIONS`.'),
});
