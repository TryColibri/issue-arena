import { describe, expect, it } from 'vitest';

import { type Condition } from '@/shared/api';

import {
  completeConditions,
  FIELDS,
  newCondition,
  operatorsOf,
  type Row,
  toFilter,
  withOperator,
} from './filter-model';

const row = (condition: Condition, key = 'k'): Row => ({ key, condition });

describe('newCondition', () => {
  it.each(FIELDS.map(({ field }) => field))(
    '%s starts out incomplete',
    (field) => {
      const condition = newCondition(field);
      expect(condition.field).toBe(field);
      // Estimate starts valid (> 0); every other field still needs a value.
      expect(completeConditions([row(condition)])).toHaveLength(
        field === 'estimate' ? 1 : 0,
      );
    },
  );
});

describe('operatorsOf', () => {
  it('offers is / is not for set fields', () => {
    expect(operatorsOf('team').map((o) => o.value)).toEqual(['is', 'isNot']);
  });
  it('offers comparisons for estimate', () => {
    expect(operatorsOf('estimate').map((o) => o.value)).toEqual([
      'lt',
      'gt',
      'eq',
      'none',
    ]);
  });
  it('offers before / after for dates', () => {
    expect(operatorsOf('dueDate').map((o) => o.value)).toEqual([
      'before',
      'after',
    ]);
  });
});

describe('withOperator', () => {
  it('keeps the values when switching is to is not', () => {
    expect(
      withOperator({ field: 'team', operator: 'is', ids: ['a'] }, 'isNot'),
    ).toEqual({
      field: 'team',
      operator: 'isNot',
      ids: ['a'],
    });
  });

  it('drops the estimate value for none and restores a default after', () => {
    const none = withOperator(
      { field: 'estimate', operator: 'gt', value: 5 },
      'none',
    );
    expect(none).toEqual({ field: 'estimate', operator: 'none' });
    expect(withOperator(none, 'lt')).toEqual({
      field: 'estimate',
      operator: 'lt',
      value: 0,
    });
  });

  it('keeps the date when switching before to after', () => {
    expect(
      withOperator(
        { field: 'dueDate', operator: 'before', value: '2026-01-01' },
        'after',
      ),
    ).toEqual({ field: 'dueDate', operator: 'after', value: '2026-01-01' });
  });

  it('ignores an operator the field does not have', () => {
    const condition: Condition = { field: 'team', operator: 'is', ids: ['a'] };
    expect(withOperator(condition, 'lt')).toBe(condition);
  });
});

describe('toFilter', () => {
  it('builds the AST from finished rows only', () => {
    const rows = [
      row({ field: 'team', operator: 'is', ids: ['eng'] }, '1'),
      row({ field: 'priority', operator: 'is', values: [1, 2] }, '2'),
      row({ field: 'label', operator: 'isNot', ids: ['chore'] }, '3'),
      row(newCondition('project'), '4'),
    ];
    expect(toFilter('all', rows)).toEqual({
      match: 'all',
      conditions: [
        { field: 'team', operator: 'is', ids: ['eng'] },
        { field: 'priority', operator: 'is', values: [1, 2] },
        { field: 'label', operator: 'isNot', ids: ['chore'] },
      ],
    });
  });

  it('carries the match mode', () => {
    expect(toFilter('any', [])).toEqual({ match: 'any', conditions: [] });
  });

  it('accepts relative durations and ISO dates, and rejects anything else', () => {
    const date = (value: string) =>
      row({ field: 'dueDate', operator: 'before', value });
    expect(
      completeConditions([date('2026-01-31'), date('-P2W'), date('soon')]),
    ).toHaveLength(2);
  });

  it('never exceeds the condition limit', () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      row({ field: 'title', operator: 'contains', value: 'x' }, String(i)),
    );
    expect(toFilter('all', rows).conditions).toHaveLength(20);
  });
});
