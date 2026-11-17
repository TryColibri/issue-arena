import { describe, expect, it } from 'vitest';

import { type Condition, type IssueFilter } from '@/shared/api';

import {
  compileCondition,
  compileIssueFilter,
  compileScope,
} from './compile-filter';

const NOT_FINISHED = { state: { type: { nin: ['completed', 'canceled'] } } };

describe('compileScope', () => {
  it('always excludes completed and canceled issues', () => {
    expect(compileScope({ type: 'all' })).toEqual({
      and: [NOT_FINISHED, {}],
    });
  });

  it.each([
    [{ type: 'my' }, { assignee: { isMe: { eq: true } } }],
    [{ type: 'backlog' }, { state: { type: { eq: 'backlog' } } }],
    [{ type: 'todo' }, { state: { type: { eq: 'unstarted' } } }],
    [{ type: 'project', projectId: 'p1' }, { project: { id: { eq: 'p1' } } }],
    [
      { type: 'initiative', initiativeId: 'i1' },
      { project: { initiatives: { some: { id: { eq: 'i1' } } } } },
    ],
  ] as const)('compiles %j', (scope, expected) => {
    expect(compileScope(scope)).toEqual({ and: [NOT_FINISHED, expected] });
  });

  it('wraps a custom filter in the exclusion', () => {
    const filter: IssueFilter = {
      match: 'all',
      conditions: [{ field: 'title', operator: 'contains', value: 'bug' }],
    };
    expect(compileScope({ type: 'custom', filter })).toEqual({
      and: [NOT_FINISHED, { title: { containsIgnoreCase: 'bug' } }],
    });
  });
});

describe('compileIssueFilter', () => {
  const a: Condition = { field: 'priority', operator: 'is', values: [1] };
  const b: Condition = { field: 'team', operator: 'is', ids: ['t1'] };

  it('joins conditions with and for all', () => {
    expect(compileIssueFilter({ match: 'all', conditions: [a, b] })).toEqual({
      and: [{ priority: { in: [1] } }, { team: { id: { in: ['t1'] } } }],
    });
  });

  it('joins conditions with or for any', () => {
    expect(compileIssueFilter({ match: 'any', conditions: [a, b] })).toEqual({
      or: [{ priority: { in: [1] } }, { team: { id: { in: ['t1'] } } }],
    });
  });

  it('does not nest a single condition', () => {
    expect(compileIssueFilter({ match: 'any', conditions: [a] })).toEqual({
      priority: { in: [1] },
    });
  });

  it('matches everything without conditions', () => {
    expect(compileIssueFilter({ match: 'all', conditions: [] })).toEqual({});
  });
});

describe('compileCondition', () => {
  describe('team', () => {
    it('is', () => {
      expect(
        compileCondition({ field: 'team', operator: 'is', ids: ['a', 'b'] }),
      ).toEqual({ team: { id: { in: ['a', 'b'] } } });
    });
    it('isNot', () => {
      expect(
        compileCondition({ field: 'team', operator: 'isNot', ids: ['a'] }),
      ).toEqual({ team: { id: { nin: ['a'] } } });
    });
  });

  describe('status', () => {
    it('splits state types from state IDs', () => {
      expect(
        compileCondition({
          field: 'status',
          operator: 'is',
          ids: ['backlog', 'uuid-1'],
        }),
      ).toEqual({
        or: [
          { state: { type: { in: ['backlog'] } } },
          { state: { id: { in: ['uuid-1'] } } },
        ],
      });
    });
    it('isNot requires neither', () => {
      expect(
        compileCondition({
          field: 'status',
          operator: 'isNot',
          ids: ['started', 'uuid-1'],
        }),
      ).toEqual({
        and: [
          { state: { type: { nin: ['started'] } } },
          { state: { id: { nin: ['uuid-1'] } } },
        ],
      });
    });
  });

  describe('assignee', () => {
    it('is me', () => {
      expect(
        compileCondition({ field: 'assignee', operator: 'is', ids: ['me'] }),
      ).toEqual({ assignee: { isMe: { eq: true } } });
    });
    it('is unassigned or a user', () => {
      expect(
        compileCondition({
          field: 'assignee',
          operator: 'is',
          ids: ['none', 'u1'],
        }),
      ).toEqual({
        or: [
          { assignee: { null: true } },
          { assignee: { id: { in: ['u1'] } } },
        ],
      });
    });
    it('isNot a user still matches unassigned issues', () => {
      expect(
        compileCondition({ field: 'assignee', operator: 'isNot', ids: ['u1'] }),
      ).toEqual({
        or: [
          { assignee: { null: true } },
          { assignee: { id: { nin: ['u1'] } } },
        ],
      });
    });
    it('isNot unassigned requires an assignee', () => {
      expect(
        compileCondition({
          field: 'assignee',
          operator: 'isNot',
          ids: ['none'],
        }),
      ).toEqual({ assignee: { null: false } });
    });
    it('isNot me', () => {
      expect(
        compileCondition({ field: 'assignee', operator: 'isNot', ids: ['me'] }),
      ).toEqual({
        or: [
          { assignee: { null: true } },
          { assignee: { isMe: { eq: false } } },
        ],
      });
    });
  });

  it('creator', () => {
    expect(
      compileCondition({ field: 'creator', operator: 'is', ids: ['u1'] }),
    ).toEqual({ creator: { id: { in: ['u1'] } } });
  });

  describe('cycle', () => {
    it('is current', () => {
      expect(
        compileCondition({ field: 'cycle', operator: 'is', ids: ['current'] }),
      ).toEqual({ cycle: { isActive: { eq: true } } });
    });
    it('is a cycle', () => {
      expect(
        compileCondition({ field: 'cycle', operator: 'is', ids: ['c1'] }),
      ).toEqual({ cycle: { id: { in: ['c1'] } } });
    });
  });

  describe('priority', () => {
    it('is', () => {
      expect(
        compileCondition({ field: 'priority', operator: 'is', values: [1, 2] }),
      ).toEqual({ priority: { in: [1, 2] } });
    });
    it('isNot', () => {
      expect(
        compileCondition({ field: 'priority', operator: 'isNot', values: [4] }),
      ).toEqual({ priority: { nin: [4] } });
    });
  });

  describe('label', () => {
    it('is: some label matches', () => {
      expect(
        compileCondition({ field: 'label', operator: 'is', ids: ['l1'] }),
      ).toEqual({ labels: { some: { id: { in: ['l1'] } } } });
    });
    it('isNot: no label matches', () => {
      expect(
        compileCondition({ field: 'label', operator: 'isNot', ids: ['l1'] }),
      ).toEqual({ labels: { every: { id: { nin: ['l1'] } } } });
    });
  });

  describe('project', () => {
    it('is', () => {
      expect(
        compileCondition({ field: 'project', operator: 'is', ids: ['p1'] }),
      ).toEqual({ project: { id: { in: ['p1'] } } });
    });
    it('isNot keeps issues without a project', () => {
      expect(
        compileCondition({ field: 'project', operator: 'isNot', ids: ['p1'] }),
      ).toEqual({
        or: [{ project: { null: true } }, { project: { id: { nin: ['p1'] } } }],
      });
    });
  });

  describe('initiative', () => {
    it('is', () => {
      expect(
        compileCondition({ field: 'initiative', operator: 'is', ids: ['i1'] }),
      ).toEqual({ project: { initiatives: { some: { id: { in: ['i1'] } } } } });
    });
    it('isNot', () => {
      expect(
        compileCondition({
          field: 'initiative',
          operator: 'isNot',
          ids: ['i1'],
        }),
      ).toEqual({
        or: [
          { project: { null: true } },
          { project: { initiatives: { every: { id: { nin: ['i1'] } } } } },
        ],
      });
    });
  });

  describe('estimate', () => {
    it.each(['lt', 'gt', 'eq'] as const)('%s', (operator) => {
      expect(
        compileCondition({ field: 'estimate', operator, value: 3 }),
      ).toEqual({ estimate: { [operator]: 3 } });
    });
    it('none', () => {
      expect(compileCondition({ field: 'estimate', operator: 'none' })).toEqual(
        { estimate: { null: true } },
      );
    });
  });

  describe('dates', () => {
    it('dueDate before', () => {
      expect(
        compileCondition({
          field: 'dueDate',
          operator: 'before',
          value: '2026-01-31',
        }),
      ).toEqual({ dueDate: { lt: '2026-01-31' } });
    });
    it('createdAt after a relative duration', () => {
      expect(
        compileCondition({
          field: 'createdAt',
          operator: 'after',
          value: '-P2W',
        }),
      ).toEqual({ createdAt: { gt: '-P2W' } });
    });
    it('updatedAt before turns a bare date into a timestamp', () => {
      expect(
        compileCondition({
          field: 'updatedAt',
          operator: 'before',
          value: '2026-01-31',
        }),
      ).toEqual({ updatedAt: { lt: '2026-01-31T00:00:00.000Z' } });
    });
  });

  it('title contains, ignoring case', () => {
    expect(
      compileCondition({ field: 'title', operator: 'contains', value: 'Bug' }),
    ).toEqual({ title: { containsIgnoreCase: 'Bug' } });
  });
});
