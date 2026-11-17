import { z } from 'zod';

import { type IssueFilter, issueFilterSchema } from './issue-filter';

/**
 * Which issues an arena ranks. Every scope also excludes issues whose state
 * type is `completed` or `canceled`.
 */
export type Scope =
  | { type: 'my' }
  | { type: 'backlog' }
  | { type: 'todo' }
  | { type: 'project'; projectId: string }
  | { type: 'initiative'; initiativeId: string }
  | { type: 'all' }
  | { type: 'custom'; filter: IssueFilter };

export const scopeSchema: z.ZodType<Scope> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('my') }),
  z.strictObject({ type: z.literal('backlog') }),
  z.strictObject({ type: z.literal('todo') }),
  z.strictObject({ type: z.literal('project'), projectId: z.string().min(1) }),
  z.strictObject({
    type: z.literal('initiative'),
    initiativeId: z.string().min(1),
  }),
  z.strictObject({ type: z.literal('all') }),
  z.strictObject({ type: z.literal('custom'), filter: issueFilterSchema }),
]);
