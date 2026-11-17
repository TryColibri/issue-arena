import {
  ASSIGNEE_ME,
  ASSIGNEE_NONE,
  type Condition,
  CYCLE_CURRENT,
  type IssueFilter,
  type Scope,
  type SetOperator,
} from '@/shared/api';

/**
 * A Linear `IssueFilter` input. Linear's schema is large and this server only
 * ever builds filters from the closed set of scopes and conditions below, so
 * the output is typed loosely.
 */
export type LinearFilter = Record<string, unknown>;

/** Workflow state types a `status` condition may name instead of a state ID. */
const STATE_TYPES = new Set([
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]);

/** Every scope leaves out issues that are done or canceled. */
const NOT_FINISHED: LinearFilter = {
  state: { type: { nin: ['completed', 'canceled'] } },
};

const all = (parts: LinearFilter[]): LinearFilter =>
  parts.length === 1 ? (parts[0] ?? {}) : { and: parts };

const any = (parts: LinearFilter[]): LinearFilter =>
  parts.length === 1 ? (parts[0] ?? {}) : { or: parts };

/**
 * Relation fields that may be empty (assignee, creator, project, cycle).
 * `is` matches any listed value. `isNot` also matches issues with no value,
 * unless `none` is listed, which is spelled out so the result does not depend
 * on how Linear treats null in `nin`.
 */
const nullableRelation = (
  field: string,
  operator: SetOperator,
  ids: string[],
): LinearFilter => {
  const specials = {
    [ASSIGNEE_ME]: { isMe: { eq: true } },
    [CYCLE_CURRENT]: { isActive: { eq: true } },
  } as const;
  const negatedSpecials = {
    [ASSIGNEE_ME]: { isMe: { eq: false } },
    [CYCLE_CURRENT]: { isActive: { eq: false } },
  } as const;
  const wantsNone = ids.includes(ASSIGNEE_NONE);
  const plain = ids.filter((id) => id !== ASSIGNEE_NONE && !(id in specials));
  const special = ids.filter(
    (id): id is keyof typeof specials => id in specials,
  );

  if (operator === 'is') {
    const parts: LinearFilter[] = [];
    if (wantsNone) {
      parts.push({ [field]: { null: true } });
    }
    for (const id of special) {
      parts.push({ [field]: specials[id] });
    }
    if (plain.length > 0) {
      parts.push({ [field]: { id: { in: plain } } });
    }
    return any(parts);
  }

  const excluded: LinearFilter[] = [];
  for (const id of special) {
    excluded.push({ [field]: negatedSpecials[id] });
  }
  if (plain.length > 0) {
    excluded.push({ [field]: { id: { nin: plain } } });
  }
  if (wantsNone) {
    return all([{ [field]: { null: false } }, ...excluded]);
  }
  return all(excluded.map((part) => any([{ [field]: { null: true } }, part])));
};

const compileStatus = (operator: SetOperator, ids: string[]): LinearFilter => {
  const types = ids.filter((id) => STATE_TYPES.has(id));
  const stateIDs = ids.filter((id) => !STATE_TYPES.has(id));
  const key = operator === 'is' ? 'in' : 'nin';
  const parts: LinearFilter[] = [];
  if (types.length > 0) {
    parts.push({ state: { type: { [key]: types } } });
  }
  if (stateIDs.length > 0) {
    parts.push({ state: { id: { [key]: stateIDs } } });
  }
  return operator === 'is' ? any(parts) : all(parts);
};

const compileLabel = (operator: SetOperator, ids: string[]): LinearFilter =>
  operator === 'is'
    ? { labels: { some: { id: { in: ids } } } }
    : { labels: { every: { id: { nin: ids } } } };

const compileInitiative = (
  operator: SetOperator,
  ids: string[],
): LinearFilter =>
  operator === 'is'
    ? { project: { initiatives: { some: { id: { in: ids } } } } }
    : any([
        { project: { null: true } },
        { project: { initiatives: { every: { id: { nin: ids } } } } },
      ]);

/** A bare date is a valid `DateTimeOrDuration` only as a full timestamp. */
const toDateTime = (value: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;

/**
 * Compiles one condition to a Linear `IssueFilter`.
 *
 * @param condition - A validated condition.
 */
export function compileCondition(condition: Condition): LinearFilter {
  switch (condition.field) {
    case 'team':
      return {
        team: {
          id: { [condition.operator === 'is' ? 'in' : 'nin']: condition.ids },
        },
      };
    case 'status':
      return compileStatus(condition.operator, condition.ids);
    case 'assignee':
    case 'creator':
    case 'project':
    case 'cycle':
      return nullableRelation(
        condition.field,
        condition.operator,
        condition.ids,
      );
    case 'label':
      return compileLabel(condition.operator, condition.ids);
    case 'initiative':
      return compileInitiative(condition.operator, condition.ids);
    case 'priority':
      return {
        priority: {
          [condition.operator === 'is' ? 'in' : 'nin']: condition.values,
        },
      };
    case 'estimate':
      return condition.operator === 'none'
        ? { estimate: { null: true } }
        : { estimate: { [condition.operator]: condition.value ?? 0 } };
    case 'dueDate':
      return {
        dueDate: {
          [condition.operator === 'before' ? 'lt' : 'gt']: condition.value,
        },
      };
    case 'createdAt':
    case 'updatedAt':
      return {
        [condition.field]: {
          [condition.operator === 'before' ? 'lt' : 'gt']: toDateTime(
            condition.value,
          ),
        },
      };
    case 'title':
      return { title: { containsIgnoreCase: condition.value } };
  }
}

/**
 * Compiles a custom filter: conditions joined with `and` (`all`) or `or`
 * (`any`). An empty filter matches everything.
 *
 * @param filter - A validated filter.
 */
export function compileIssueFilter(filter: IssueFilter): LinearFilter {
  const parts = filter.conditions.map(compileCondition);
  if (parts.length === 0) {
    return {};
  }
  return filter.match === 'all' ? all(parts) : any(parts);
}

/**
 * The Linear filter for a scope, always wrapped so finished issues (state type
 * `completed` or `canceled`) are excluded.
 *
 * @param scope - A validated scope.
 */
export function compileScope(scope: Scope): LinearFilter {
  return { and: [NOT_FINISHED, scopeFilter(scope)] };
}

function scopeFilter(scope: Scope): LinearFilter {
  switch (scope.type) {
    case 'my':
      return { assignee: { isMe: { eq: true } } };
    case 'backlog':
      return { state: { type: { eq: 'backlog' } } };
    case 'todo':
      return { state: { type: { eq: 'unstarted' } } };
    case 'project':
      return { project: { id: { eq: scope.projectId } } };
    case 'initiative':
      return {
        project: { initiatives: { some: { id: { eq: scope.initiativeId } } } },
      };
    case 'all':
      return {};
    case 'custom':
      return compileIssueFilter(scope.filter);
  }
}
