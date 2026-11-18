import { z } from 'zod';

import { type Scope, scopeSchema } from './scope';

/** Linear workflow state types. */
export type StateType =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled';

/** The most issues an arena may rank. */
export const MAX_ARENA_ISSUES = 150;

/** The most issues `POST /api/v1/issues/search` returns. */
export const MAX_SEARCH_ISSUES = 500;

/** Longest description excerpt kept on an issue, in characters. */
export const MAX_EXCERPT_LENGTH = 400;

/** A Linear issue, snapshotted with the fields an issue card shows. */
export type Issue = {
  /** Linear issue ID. */
  id: string;
  /** Human identifier, e.g. `ENG-123`. */
  identifier: string;
  /** Issue title. */
  title: string;
  /** URL of the issue in Linear. */
  url: string;
  /** Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
  priority: number;
  /** Linear's label for the priority, e.g. `High`. */
  priorityLabel: string;
  /** Linear's manual order: lower values come first within a priority. */
  sortOrder: number;
  /** Workflow state. */
  state: {
    /** State name, e.g. `In Progress`. */
    name: string;
    /** State type. */
    type: StateType;
  };
  /** Key of the issue's team, e.g. `ENG`. */
  teamKey: string;
  /** The assignee, or `null` when unassigned. */
  assignee: {
    /** Display name. */
    name: string;
    /** Avatar image URL, or `null`. */
    avatarUrl: string | null;
  } | null;
  /** Name of the issue's project, or `null`. */
  projectName: string | null;
  /** Label names. */
  labels: string[];
  /** Whether an issue that is still open blocks this one. */
  blocked: boolean;
  /** Estimate, or `null`. */
  estimate: number | null;
  /** Due date as `YYYY-MM-DD`, or `null`. */
  dueDate: string | null;
  /** Description as plain text, cut to `MAX_EXCERPT_LENGTH` characters. */
  excerpt: string;
};

export const stateTypeSchema: z.ZodType<StateType> = z.enum([
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]);

export const issueSchema: z.ZodType<Issue> = z.strictObject({
  id: z.string().describe('Linear issue ID.'),
  identifier: z.string().describe('Human identifier, e.g. `ENG-123`.'),
  title: z.string().describe('Issue title.'),
  url: z.string().describe('URL of the issue in Linear.'),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe('Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.'),
  priorityLabel: z
    .string()
    .describe("Linear's label for the priority, e.g. `High`."),
  sortOrder: z
    .number()
    .describe(
      "Linear's manual order: lower values come first within a priority.",
    ),
  state: z
    .strictObject({
      name: z.string().describe('State name, e.g. `In Progress`.'),
      type: stateTypeSchema.describe('State type.'),
    })
    .describe('Workflow state.'),
  teamKey: z.string().describe("Key of the issue's team, e.g. `ENG`."),
  assignee: z
    .strictObject({
      name: z.string().describe('Display name.'),
      avatarUrl: z.string().nullable().describe('Avatar image URL, or `null`.'),
    })
    .nullable()
    .describe('The assignee, or `null` when unassigned.'),
  projectName: z
    .string()
    .nullable()
    .describe("Name of the issue's project, or `null`."),
  labels: z.array(z.string()).describe('Label names.'),
  blocked: z
    .boolean()
    .default(false)
    .describe('Whether an issue that is still open blocks this one.'),
  estimate: z.number().nullable().describe('Estimate, or `null`.'),
  dueDate: z
    .string()
    .nullable()
    .describe('Due date as `YYYY-MM-DD`, or `null`.'),
  excerpt: z
    .string()
    .max(MAX_EXCERPT_LENGTH)
    .describe(
      'Description as plain text, cut to `MAX_EXCERPT_LENGTH` characters.',
    ),
});

/** Body of `POST /api/v1/issues/search`. */
export type IssueSearchRequest = {
  /** Which issues to fetch. */
  scope: Scope;
};

export const issueSearchRequestSchema: z.ZodType<IssueSearchRequest> =
  z.strictObject({ scope: scopeSchema.describe('Which issues to fetch.') });

/** Response of `POST /api/v1/issues/search`. */
export type IssueSearchResponse = {
  /** Issues in scope, at most `MAX_SEARCH_ISSUES`. */
  items: Issue[];
  /** Whether more issues matched than `items` holds. */
  truncated: boolean;
};

export const issueSearchResponseSchema: z.ZodType<IssueSearchResponse> =
  z.strictObject({
    items: z
      .array(issueSchema)
      .max(MAX_SEARCH_ISSUES)
      .describe('Issues in scope, at most `MAX_SEARCH_ISSUES`.'),
    truncated: z
      .boolean()
      .describe('Whether more issues matched than `items` holds.'),
  });
