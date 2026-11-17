import { type Arena, type Issue } from '@/shared/api';

/** A minimal issue, for tests. */
export const testIssue = (
  id: string,
  overrides: Partial<Issue> = {},
): Issue => ({
  id,
  identifier: `T-${id}`,
  title: `Issue ${id}`,
  url: `https://linear.app/t/issue/T-${id}`,
  priority: 2,
  priorityLabel: 'High',
  sortOrder: Number(id.length === 1 ? id.charCodeAt(0) : 0),
  state: { name: 'Todo', type: 'unstarted' },
  teamKey: 'T',
  assignee: null,
  projectName: null,
  labels: [],
  estimate: null,
  dueDate: null,
  excerpt: '',
  ...overrides,
});

/** The arena ID tests use. */
export const TEST_ARENA_ID = '11111111-1111-4111-8111-111111111111';

/** A fresh arena over issues `a`, `b`, `c`, … for tests. */
export const testArena = (overrides: Partial<Arena> = {}): Arena => ({
  id: TEST_ARENA_ID,
  scopeLabel: 'All issues',
  scope: { type: 'all' },
  n: 2,
  candidates: ['a', 'b', 'c'].map((id) => testIssue(id)),
  answers: [],
  dropped: [],
  revision: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});
