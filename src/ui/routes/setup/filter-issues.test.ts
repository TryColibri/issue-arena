import { describe, expect, it } from 'vitest';

import { type Issue } from '@/shared/api';

import { clampN, facetsOf, filterIssues, NO_FILTERS } from './filter-issues';

const issue = (id: string, overrides: Partial<Issue> = {}): Issue => ({
  id,
  identifier: `T-${id}`,
  title: id,
  url: '',
  priority: 2,
  priorityLabel: 'High',
  sortOrder: 0,
  state: { name: 'Todo', type: 'unstarted' },
  teamKey: 'ENG',
  blocked: false,
  assignee: null,
  projectName: null,
  labels: [],
  estimate: null,
  dueDate: null,
  excerpt: '',
  ...overrides,
});

const issues = [
  issue('1', { labels: ['bug'] }),
  issue('2', { priority: 1, priorityLabel: 'Urgent', blocked: true }),
  issue('3', {
    priority: 0,
    priorityLabel: 'No priority',
    state: { name: 'Backlog', type: 'backlog' },
    labels: ['bug', 'chore'],
  }),
];

const ids = (list: Issue[]) => list.map((entry) => entry.id);

describe('filterIssues', () => {
  it('keeps everything without filters', () => {
    expect(filterIssues(issues, NO_FILTERS)).toEqual(issues);
  });

  it('matches any value within a chip', () => {
    expect(
      ids(filterIssues(issues, { ...NO_FILTERS, states: ['Todo', 'Backlog'] })),
    ).toEqual(['1', '2', '3']);
  });

  it('requires every chip to match', () => {
    const filters = {
      ...NO_FILTERS,
      priorities: ['0', '2'],
      states: ['Backlog'],
    };
    expect(ids(filterIssues(issues, filters))).toEqual(['3']);
  });

  it('keeps blocked issues unless asked to hide them', () => {
    expect(ids(filterIssues(issues, NO_FILTERS))).toEqual(['1', '2', '3']);
    expect(
      ids(filterIssues(issues, { ...NO_FILTERS, hideBlocked: true })),
    ).toEqual(['1', '3']);
  });

  it('filters by priority', () => {
    expect(
      ids(filterIssues(issues, { ...NO_FILTERS, priorities: ['1'] })),
    ).toEqual(['2']);
  });

  it('matches issues with at least one selected label', () => {
    expect(
      ids(filterIssues(issues, { ...NO_FILTERS, labels: ['chore'] })),
    ).toEqual(['3']);
    expect(
      ids(filterIssues(issues, { ...NO_FILTERS, labels: ['bug', 'chore'] })),
    ).toEqual(['1', '3']);
  });
});

describe('facetsOf', () => {
  it('counts issues per choice', () => {
    const facets = facetsOf(issues);
    expect(facets.states).toEqual([
      { value: 'Backlog', label: 'Backlog', hint: '1' },
      { value: 'Todo', label: 'Todo', hint: '2' },
    ]);
    expect(facets.labels).toEqual([
      { value: 'bug', label: 'bug', hint: '2' },
      { value: 'chore', label: 'chore', hint: '1' },
    ]);
  });

  it('orders priorities from urgent to none', () => {
    expect(facetsOf(issues).priorities.map((option) => option.value)).toEqual([
      '1',
      '2',
      '0',
    ]);
  });
});

describe('clampN', () => {
  it.each([
    ['10', 50, 10],
    ['0', 50, 1],
    ['-4', 50, 1],
    ['99', 50, 50],
    ['abc', 50, 10],
    ['', 5, 5],
    ['3', 0, 1],
  ])('clampN(%j, %d) is %d', (text, max, expected) => {
    expect(clampN(text, max)).toBe(expected);
  });
});
